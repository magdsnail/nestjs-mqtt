import { Provider, Logger } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { MqttModuleOptions } from './mqtt.interface';
import { MQTT_CLIENT_INSTANCE, MQTT_OPTION_PROVIDER, MQTT_LOGGER_PROVIDER } from './mqtt.constants';
import { readFileSync } from 'fs';

let client: MqttClient;

function loadConfig(options: MqttModuleOptions) {
  client.options = {
    ...client.options,
    ...options,
    ...(options.load ? JSON.parse(readFileSync(options.load, 'utf-8')) : {}),
  };
}

function retryConnect(options: MqttModuleOptions) {
  if (!options.load) {
    return;
  }
  loadConfig(options);
  // client.connect();
}

export function createClientProvider(): Provider {
  return {
    provide: MQTT_CLIENT_INSTANCE,
    useFactory: (options: MqttModuleOptions, logger: Logger) => {
      client = connect(options);

      client.on('connect', () => {
        logger.log('MQTT connected');
      });

      client.on('disconnect', packet => {
        logger.log('MQTT disconnected');
      });

      client.on('error', (error: any) => {
        console.log(error);
      });

      client.on('reconnect', async () => {
        logger.log('MQTT reconnecting');
        retryConnect(options);
      });

      client.on('close', () => {
        logger.log('MQTT closed');
      });

      client.on('offline', () => {
        logger.log('MQTT offline');
      });

      return client;
    },
    inject: [MQTT_OPTION_PROVIDER, MQTT_LOGGER_PROVIDER],
  };
}
