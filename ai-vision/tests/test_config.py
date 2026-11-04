import pytest

from conftest import camera_data, write_yaml
from swiftletcare_ai.config import (
    DEFAULT_SNAPSHOT_MAX_BYTES, ConfigError, check_confirm_fps, load_camera_config, load_env, read_env_file,
)


def load(tmp_path, data, name='H1-F0-CAMERA.yaml'):
    return load_camera_config(write_yaml(tmp_path, data, name), tmp_path)


def expect_error(tmp_path, data, *fragments, name='H1-F0-CAMERA.yaml'):
    with pytest.raises(ConfigError) as e:
        load(tmp_path, data, name)
    msg = str(e.value)
    assert name in msg
    for f in fragments:
        assert f in msg, msg
    return msg


def test_cau_hinh_hop_le(tmp_path):
    cfg = load(tmp_path, camera_data())
    assert cfg.camera == 'H1-F0-CAMERA'
    assert cfg.playlist == (tmp_path / 'data' / 'videos' / 'V01.mp4',)
    assert cfg.line.start == (0.10, 0.55) and cfg.line.end == (0.90, 0.55)
    assert cfg.swiftlet_confidence == 0.40
    assert cfg.predator.confirm_frames == 3 and cfg.predator.cooldown_seconds == 300
    assert cfg.process_fps is None


def test_camera_khong_co_trong_danh_sach(tmp_path):
    expect_error(tmp_path, camera_data(camera='H9-F0-CAMERA'), 'camera', 'H9-F0-CAMERA', 'H1-F0-CAMERA',
                 name='H9-F0-CAMERA.yaml')


def test_camera_khac_ten_file(tmp_path):
    expect_error(tmp_path, camera_data(camera='H2-F0-CAMERA'), 'camera', 'H2-F0-CAMERA')


def test_playlist_rong(tmp_path):
    expect_error(tmp_path, camera_data(playlist=[]), 'playlist')


def test_playlist_file_khong_ton_tai(tmp_path):
    expect_error(tmp_path, camera_data(playlist=['data/videos/X.mp4']), 'playlist', 'X.mp4')


def test_playlist_duong_dan_ngoai_ascii(tmp_path):
    (tmp_path / 'data' / 'videos').mkdir(parents=True)
    (tmp_path / 'data' / 'videos' / 'Yến 01.mp4').write_bytes(b'video')
    msg = expect_error(tmp_path, camera_data(playlist=['data/videos/Yến 01.mp4']), 'playlist', 'ASCII')
    assert 'doi ten' in msg


def test_playlist_khong_phai_danh_sach(tmp_path):
    expect_error(tmp_path, camera_data(playlist='data/videos/V01.mp4'), 'playlist')


@pytest.mark.parametrize('line,field', [
    ({'start': [1.2, 0.5], 'end': [0.9, 0.5]}, 'line.start'),
    ({'start': [0.1, 0.5], 'end': [0.9, -0.1]}, 'line.end'),
    ({'start': [0.5, 0.5], 'end': [0.5, 0.5]}, 'line'),
    ({'start': [0.1], 'end': [0.9, 0.5]}, 'line.start'),
    ({'start': [0.1, 0.5]}, 'line.end'),
    ({'start': [0.1, 0.5], 'end': [0.9, 0.5], 'flip': True}, 'line.flip'),
])
def test_vach_sai(tmp_path, line, field):
    expect_error(tmp_path, camera_data(line=line), field)


@pytest.mark.parametrize('value', [0, -0.1, 1.5, 'cao', True])
def test_swiftlet_confidence_sai(tmp_path, value):
    expect_error(tmp_path, camera_data(swiftlet={'confidence': value}), 'swiftlet.confidence', '(0, 1]')


@pytest.mark.parametrize('value', [0.49, 1.01])
def test_predator_confidence_ngoai_khoang(tmp_path, value):
    data = camera_data()
    data['predator']['confidence'] = value
    expect_error(tmp_path, data, 'predator.confidence', '[0.5, 1]')


@pytest.mark.parametrize('field,value', [
    ('confirm_frames', 0), ('confirm_frames', 2.5), ('confirm_seconds', 0), ('cooldown_seconds', -1),
])
def test_predator_so_duong(tmp_path, field, value):
    data = camera_data()
    data['predator'][field] = value
    expect_error(tmp_path, data, f'predator.{field}')


@pytest.mark.parametrize('value', [0, -5, 'nhanh'])
def test_process_fps_sai(tmp_path, value):
    expect_error(tmp_path, camera_data(process_fps=value), 'process_fps')


def test_process_fps_so_duong(tmp_path):
    assert load(tmp_path, camera_data(process_fps=8)).process_fps == 8


def test_thieu_truong(tmp_path):
    data = camera_data()
    del data['process_fps']
    expect_error(tmp_path, data, 'process_fps', 'thieu')


def test_truong_la(tmp_path):
    expect_error(tmp_path, camera_data(imgsz=640), 'imgsz', 'la')


def test_file_rong(tmp_path):
    path = tmp_path / 'H1-F0-CAMERA.yaml'
    path.write_text('', encoding='utf-8')
    with pytest.raises(ConfigError, match='H1-F0-CAMERA.yaml'):
        load_camera_config(path, tmp_path)


def test_yaml_co_bom_van_doc_duoc(tmp_path):
    path = write_yaml(tmp_path, camera_data())
    path.write_bytes(b'\xef\xbb\xbf' + path.read_bytes())
    assert load_camera_config(path, tmp_path).camera == 'H1-F0-CAMERA'


def test_hai_file_cau_hinh_mau_hop_le():
    from swiftletcare_ai.config import AI_DIR
    for cam in ('H1-F0-CAMERA', 'H2-F0-CAMERA'):
        text = (AI_DIR / 'cameras' / f'{cam}.yaml').read_text(encoding='utf-8')
        assert f'camera: {cam}' in text


# ---- .env ----

def test_read_env_file_bo_dong_trong_va_chu_thich_va_bom(tmp_path):
    p = tmp_path / '.env'
    p.write_bytes(b'\xef\xbb\xbf# chu thich\nBACKEND_URL=http://10.0.0.5:3000/\n\nAI_SERVICE_KEY=abc=def\n')
    assert read_env_file(p) == {'BACKEND_URL': 'http://10.0.0.5:3000/', 'AI_SERVICE_KEY': 'abc=def'}


def test_load_env_day_du(tmp_path):
    p = tmp_path / '.env'
    p.write_text('BACKEND_URL=http://localhost:3000/\nAI_SERVICE_KEY=bi-mat-123\nSNAPSHOT_MAX_BYTES=1000\n', encoding='utf-8')
    env = load_env(p, need_backend=True)
    assert env.backend_url == 'http://localhost:3000'
    assert env.service_key == 'bi-mat-123'
    assert env.snapshot_max_bytes == 1000
    assert 'bi-mat-123' not in repr(env)


def test_load_env_thieu_snapshot_dung_mac_dinh(tmp_path):
    p = tmp_path / '.env'
    p.write_text('BACKEND_URL=http://localhost:3000\nAI_SERVICE_KEY=k\n', encoding='utf-8')
    assert load_env(p, need_backend=True).snapshot_max_bytes == DEFAULT_SNAPSHOT_MAX_BYTES == 2097152


@pytest.mark.parametrize('text,var', [
    ('AI_SERVICE_KEY=k\n', 'BACKEND_URL'),
    ('BACKEND_URL=http://localhost:3000\nAI_SERVICE_KEY=\n', 'AI_SERVICE_KEY'),
])
def test_load_env_thieu_bien_bat_buoc(tmp_path, text, var):
    p = tmp_path / '.env'
    p.write_text(text, encoding='utf-8')
    with pytest.raises(ConfigError, match=var):
        load_env(p, need_backend=True)


def test_load_env_khong_in_khoa_khi_loi(tmp_path):
    p = tmp_path / '.env'
    p.write_text('AI_SERVICE_KEY=bi-mat-123\nSNAPSHOT_MAX_BYTES=abc\n', encoding='utf-8')
    with pytest.raises(ConfigError) as e:
        load_env(p, need_backend=False)
    assert 'SNAPSHOT_MAX_BYTES' in str(e.value) and 'bi-mat-123' not in str(e.value)


def test_load_env_offline_khong_can_file(tmp_path):
    env = load_env(tmp_path / '.env', need_backend=False)
    assert env.backend_url is None and env.snapshot_max_bytes == DEFAULT_SNAPSHOT_MAX_BYTES


def test_load_env_live_can_file(tmp_path):
    with pytest.raises(ConfigError, match='.env'):
        load_env(tmp_path / '.env', need_backend=True)


# ---- dieu kien fps (spec 3.4) ----

def test_check_confirm_fps_thoa():
    check_confirm_fps(3, 2, 1.5)


def test_check_confirm_fps_khong_thoa_bao_fps_va_cach_sua():
    with pytest.raises(ConfigError) as e:
        check_confirm_fps(3, 2, 1.2)
    msg = str(e.value)
    assert '1.2' in msg and 'confirm_frames' in msg and 'confirm_seconds' in msg and 'imgsz' in msg


@pytest.mark.parametrize('value', [float('nan'), float('inf'), True, 0, -1])
def test_fps_khong_hop_le_khong_duoc_bo_qua(value):
    with pytest.raises(ConfigError, match='fps'):
        check_confirm_fps(3, 2, value)


@pytest.mark.parametrize('field', ['confirm_seconds', 'cooldown_seconds', 'confidence'])
@pytest.mark.parametrize('value', [float('nan'), float('inf'), True])
def test_predator_tu_choi_so_khong_huu_han_va_bool(tmp_path, field, value):
    data = camera_data()
    data['predator'][field] = value
    expect_error(tmp_path, data, f'predator.{field}')


@pytest.mark.parametrize('value', [True, float('nan'), float('inf')])
def test_process_fps_tu_choi_bool_va_so_khong_huu_han(tmp_path, value):
    expect_error(tmp_path, camera_data(process_fps=value), 'process_fps')


def test_yaml_sai_cu_phap_bao_config_error(tmp_path):
    path = tmp_path / 'H1-F0-CAMERA.yaml'
    path.write_text('camera: [', encoding='utf-8')
    with pytest.raises(ConfigError, match='H1-F0-CAMERA.yaml'):
        load_camera_config(path, tmp_path)


def test_env_sai_ma_hoa_khong_lo_noi_dung(tmp_path):
    path = tmp_path / '.env'
    path.write_bytes(b'AI_SERVICE_KEY=secret-value\n\xff')
    with pytest.raises(ConfigError) as error:
        load_env(path, need_backend=True)
    assert 'secret-value' not in str(error.value)


def test_env_example_khong_chua_khoa():
    from swiftletcare_ai.config import AI_DIR
    values = read_env_file(AI_DIR / '.env.example')
    assert values['AI_SERVICE_KEY'] == ''
    assert values['BACKEND_URL'] == 'http://localhost:3000'


@pytest.mark.parametrize('value', ['0', '-1', '1.5', 'abc'])
def test_snapshot_max_bytes_phai_la_so_nguyen_duong(tmp_path, value):
    path = tmp_path / '.env'
    path.write_text(f'SNAPSHOT_MAX_BYTES={value}\n', encoding='utf-8')
    with pytest.raises(ConfigError, match='SNAPSHOT_MAX_BYTES'):
        load_env(path, need_backend=False)
