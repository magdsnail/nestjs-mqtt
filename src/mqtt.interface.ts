import { IClientOptions, Packet } from 'mqtt';
import { LoggerService, Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';

export type MqttMessageTransformer = (payload: Buffer) => any;

export type LoggerConstructor = new (...params) => LoggerService;

export interface MqttSubscribeOptions {
  topic: string | string[];
  queue?: boolean;
  share?: string | boolean;
  transform?: 'json' | 'text' | MqttMessageTransformer;
}

export interface MqttSubscriberParameter {
  index: number;
  type: 'payload' | 'topic' | 'packet' | 'params';
  transform?: 'json' | 'text' | MqttMessageTransformer;
}

export interface MqttSubscriber {
  topic: string;
  handle: any;
  route: string;
  provider: any;
  regexp: RegExp;
  options: MqttSubscribeOptions;
  parameters: MqttSubscriberParameter[];
}

export interface MqttLoggerOptions {
  useValue?: LoggerService;
  useClass?: Type<LoggerService>;
}

export interface MqttModuleOptions extends IClientOptions {
  /**
   * Global queue subscribe.
   * All topic will be prepend '$queue/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  queue?: boolean;

  /**
   * Global shared subscribe.
   * All topic will be prepend '$share/group/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  share?: string;

  logger?: MqttLoggerOptions;

  beforeHandle?: (topic: string, payload: Buffer, packet: Packet) => any;

  load?: string; // 动态加载文件配置

  variables?: Record<string, string>; //topic 动态变量替换
}

export interface MqttOptionsFactory {
  createMqttConnectOptions(): Promise<MqttModuleOptions> | MqttModuleOptions;
}

export interface MqttModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useExisting?: Type<MqttOptionsFactory>;
  useClass?: Type<MqttOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<MqttModuleOptions> | MqttModuleOptions;
  logger?: MqttLoggerOptions;
}
