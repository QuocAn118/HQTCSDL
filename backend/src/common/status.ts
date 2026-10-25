// MqttService (Task 13) cung cap; health doc qua lop truu tuong nay de khong phu thuoc module MQTT.
export abstract class MqttStatus {
  abstract isConnected(): boolean;
}
