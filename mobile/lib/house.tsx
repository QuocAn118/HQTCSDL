import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { api } from './api';

import { ApiError } from './errors';

import {
  useLive,
  useReloadOnConnect,
} from './live';

import {
  applyDeviceState,
  mergeLatest,
  replayDeviceStates,
  type LatestMap,
} from './merge';

import type {
  Device,
  DeviceState,
  House,
  LatestReading,
  ReadingsNew,
} from './types';

interface HouseValue {
  houses: House[] | null;
  houseId: number | null;

  setHouseId: (
    id: number
  ) => void;

  error: unknown;

  reload: () => void;
}

const HouseContext =
  createContext<HouseValue | null>(
    null
  );

export function useHouse() {
  const value =
    useContext(HouseContext);

  if (!value) {
    throw new Error(
      'useHouse phai nam trong HouseProvider'
    );
  }

  return value;
}

export function HouseProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [houses, setHouses] =
    useState<House[] | null>(null);

  const [houseId, setHouseId] =
    useState<number | null>(null);

  const [error, setError] =
    useState<unknown>(null);

  const reload =
    useCallback(() => {
      api<House[]>('/api/houses')
        .then((list) => {
          const active =
            list.filter(
              (h) => h.isActive
            );

          setHouses(active);

          setHouseId((cur) =>
            cur &&
            active.some(
              (h) =>
                h.houseId === cur
            )
              ? cur
              : active[0]
                  ?.houseId ??
                null
          );

          setError(null);
        })
        .catch(setError);
    }, []);

  useEffect(reload, [reload]);

  return (
    <HouseContext.Provider
      value={{
        houses,
        houseId,
        setHouseId,
        error,
        reload,
      }}
    >
      {children}
    </HouseContext.Provider>
  );
}

export function useLiveDevices(
  houseId: number | null
) {
  const { subscribe } =
    useLive();

  const [
    devices,
    setDevices,
  ] = useState<Device[] | null>(
    null
  );

  const [error, setError] =
    useState<ApiError | null>(
      null
    );

  const loading =
    useRef(false);

  const held =
    useRef<DeviceState[]>([]);

  useEffect(
    () =>
      subscribe(
        (event, payload) => {
          if (
            event !==
            'device.state'
          )
            return;

          const ev =
            payload as DeviceState;

          if (
            ev.houseId !==
            houseId
          )
            return;

          if (loading.current) {
            held.current.push(ev);
          } else {
            setDevices((d) =>
              d
                ? applyDeviceState(
                    d,
                    ev
                  )
                : d
            );
          }
        }
      ),
    [subscribe, houseId]
  );

  const load =
    useCallback(async () => {
      if (houseId === null)
        return;

      loading.current = true;

      held.current = [];

      try {
        const rest =
          await api<Device[]>(
            `/api/houses/${houseId}/devices`
          );

        setDevices(
          replayDeviceStates(
            rest,
            held.current
          )
        );

        setError(null);
      } catch (e) {
        setError(e as ApiError);
      } finally {
        loading.current = false;

        held.current = [];
      }
    }, [houseId]);

  useReloadOnConnect(load);

  return {
    devices,
    setDevices,
    error,
    reload: load,
  };
}

export function useLiveLatest(
  houseId: number | null
) {
  const { subscribe } =
    useLive();

  const [latest, setLatest] =
    useState<LatestMap>({});

  const [error, setError] =
    useState<ApiError | null>(
      null
    );

  useEffect(() => {
    setLatest({});
  }, [houseId]);

  useEffect(
    () =>
      subscribe(
        (event, payload) => {
          if (
            event !==
            'readings.new'
          )
            return;

          const ev =
            payload as ReadingsNew;

          if (
            ev.houseId ===
            houseId
          ) {
            setLatest((m) =>
              mergeLatest(
                m,
                ev.readings
              )
            );
          }
        }
      ),
    [subscribe, houseId]
  );

  const load =
    useCallback(async () => {
      if (houseId === null)
        return;

      try {
        const rest =
          await api<
            LatestReading[]
          >(
            `/api/houses/${houseId}/latest-readings`
          );

        setLatest((m) =>
          mergeLatest(m, rest)
        );

        setError(null);
      } catch (e) {
        setError(e as ApiError);
      }
    }, [houseId]);

  useReloadOnConnect(load);

  return {
    latest,
    error,
    reload: load,
  };
}