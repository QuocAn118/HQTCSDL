import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { APP_CONFIG } from '../config/config';
import type { AppConfig } from '../config/config';
import { ApiError } from '../common/errors';
import * as pick from '../common/pickers';
import { validateDto } from '../common/validation';
import { DbService } from '../db/db.service';
import { SpService } from '../db/sp';
import { RealtimeService } from '../realtime/realtime.service';
import { PredatorMetadataDto } from './dto';

const bad = (f: string) =>
  new ApiError(400, 'VALIDATION_ERROR', null, { fields: [f] });

export function snapshotRelPath(
  camera: string,
  cls: string,
  atIso: string,
): string {
  const s = new Date(atIso).toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ (UTC)
  const stamp = `${s.slice(0, 4)}${s.slice(5, 7)}${s.slice(8, 10)}T${s.slice(11, 13)}${s.slice(14, 16)}${s.slice(17, 19)}Z`;
  return `snapshots/${s.slice(0, 4)}/${s.slice(5, 7)}/${s.slice(8, 10)}/${camera}_${cls}_${stamp}.jpg`;
}

// Dung 8 buoc hop dong 2.4; file tam bi xoa trong finally cho moi duong khong doi ten thanh cong.
@Injectable()
export class PredatorService {
  private readonly log = new Logger('AI');

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly db: DbService,
    private readonly sp: SpService,
    private readonly rt: RealtimeService,
  ) {}

  async handle(metadataRaw: unknown, file: { buffer: Buffer } | undefined) {
    // 1. Kiem metadata, thieu anh.
    let plain: unknown;
    try {
      plain = JSON.parse(String(metadataRaw));
    } catch {
      throw bad('metadata');
    }
    const meta = await validateDto(PredatorMetadataDto, plain);
    if (!file?.buffer?.length) throw bad('image');
    // 2. Kiem camera truoc khi dung duong dan, chua ghi file.
    const cam = await this.db.prisma.devices.findFirst({
      where: { Code: meta.camera, IsActive: true, DeviceType: 'CAMERA' },
      select: { DeviceId: true },
    });
    if (!cam) throw new ApiError(404, 'CAMERA_NOT_FOUND');
    // 3. Chu ky JPEG that (kich thuoc do multer chan).
    const b = file.buffer;
    if (!(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff))
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE');
    // 4. Duong dan chi tu gia tri da kiem.
    const rel = snapshotRelPath(meta.camera, meta.class, meta.at);
    const finalPath = join(this.cfg.storageRoot, ...rel.split('/'));
    // 5. Ghi file tam.
    const tmpDir = join(this.cfg.storageRoot, 'tmp');
    const tmp = join(tmpDir, `${randomUUID()}.jpg`);
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmp, b);
    try {
      // 6. Goi SP.
      const r = await this.sp.createPredatorAlert({
        camera: meta.camera,
        class: meta.class,
        confidence: meta.confidence,
        at: meta.at,
        snapshot: rel,
      });
      if (r.created) {
        // 7. Doi ten file tam thanh file chinh thuc. 8. Loi doi ten -> log, canh bao van giu.
        try {
          await mkdir(dirname(finalPath), { recursive: true });
          await rename(tmp, finalPath);
        } catch (e) {
          this.log.error(
            `Doi ten anh canh bao ${r.alertId} loi: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`,
          );
        }
        if (r.alert)
          this.rt.emitToHouse(Number(r.alert.HouseId), 'alert.created', {
            alert: pick.alertFromSp(r.alert),
          });
      }
      return {
        created: r.created,
        alertId: r.alertId,
        skipReason: r.skipReason,
      };
    } finally {
      await unlink(tmp).catch(() => undefined); // da doi ten -> ENOENT, bo qua
    }
  }
}
