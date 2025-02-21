import { Inject, Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
  MQTT_CLIENT_INSTANCE, MQTT_LOGGER_PROVIDER, MQTT_OPTION_PROVIDER,
  MQTT_SUBSCRIBE_OPTIONS,
  MQTT_SUBSCRIBER_PARAMS,
} from './mqtt.constants';
import type { MqttClient } from 'mqtt';
import { Packet } from 'mqtt-packet';
import { getTransform } from './mqtt.transform';
import {
  MqttModuleOptions,
  MqttSubscribeOptions,
  MqttSubscriber,
  MqttSubscriberParameter,
} from './mqtt.interface';

@Injectable()
export class MqttExplorer {
  private readonly reflector = new Reflector();

  subscribers: Map<string, MqttSubscriber>;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    @Inject(MQTT_LOGGER_PROVIDER) private readonly logger: Logger,
    @Inject(MQTT_CLIENT_INSTANCE) private readonly client: MqttClient,
    @Inject(MQTT_OPTION_PROVIDER) private readonly options: MqttModuleOptions,
  ) {
    this.subscribers = new Map();

    this.onConnect();
  }

  // 1
  // onModuleInit() {
  //   this.logger.log('MqttModule dependencies initialized');
  //   this.explore();
  // }

  // 2
  // onApplicationBootstrap() {
  //   this.logger.log('MqttModule dependencies initialized');
  //   this.explore();
  // }

  onConnect() {
    this.client.on('connect', async () => {
      this.explore();
    })
  }


  preprocess(options: MqttSubscribeOptions): string | string[] {
    const processTopic = (topic) => {
      const queue = typeof options.queue === 'boolean' ? options.queue : this.options.queue;
      const share = typeof options.share === 'string' ? options.share : this.options.share;
      topic = topic.replace('$queue/', '')
        .replace(/^\$share\/([A-Za-z0-9]+)\//, '');
      if (queue) {
        return `$queue/${topic}`;
      }

      if (share) {
        return `$share/${share}/${topic}`;
      }

      return topic;
    };
    if (Array.isArray(options.topic)) {
      return options.topic.map(processTopic);
    } else {
      // this.logger.log(options.topic);
      return processTopic(options.topic);
    }
  }

  async subscribe(options: MqttSubscribeOptions, parameters: MqttSubscriberParameter[], handle, provider) {
    try {
      const topics = Array.isArray(options.topic) ? options.topic : [options.topic];
      const processedTopics = topics.map(topic => this.preprocess({ ...options, topic }));

      processedTopics.forEach(topic => {
        // @ts-ignore
        if (!this.subscribers.has(topic)) {
          this.client.subscribe(topic, err => {
            if (!err) {
              // @ts-ignore
              this.subscribers.set(topic, {
                topic,
                // @ts-ignore
                route: topic.replace('$queue/', '')
                  .replace(/^\$share\/([A-Za-z0-9]+)\//, ''),
                // @ts-ignore
                regexp: MqttExplorer.topicToRegexp(topic),
                provider,
                handle,
                options,
                parameters,
              });
              this.logger.debug(`subscribe topic [${topic}] success`);
            } else {
              this.logger.error(`subscribe topic [${topic}] failed`)
            }
          })
        }
      });

      // this.client.subscribe(this.preprocess(options), err => {
      //   if (!err) {
      //     // put it into this.subscribers;
      //     (Array.isArray(options.topic) ? options.topic : [options.topic])
      //       .forEach(topic => {
      //         if (!this.subscribers.has(topic)) {
      //           this.subscribers.set(topic, {
      //             topic,
      //             route: topic.replace('$queue/', '')
      //               .replace(/^\$share\/([A-Za-z0-9]+)\//, ''),
      //             regexp: MqttExplorer.topicToRegexp(topic),
      //             provider,
      //             handle,
      //             options,
      //             parameters,
      //           });
      //         }
      //         // this.subscribers.push({
      //         //   topic,
      //         //   route: topic.replace('$queue/', '')
      //         //     .replace(/^\$share\/([A-Za-z0-9]+)\//, ''),
      //         //   regexp: MqttExplorer.topicToRegexp(topic),
      //         //   provider,
      //         //   handle,
      //         //   options,
      //         //   parameters,
      //         // });
      //       });
      //     this.logger.debug(`subscribe topic [${options.topic}] success`);
      //   } else {
      //     this.logger.error(
      //       `subscribe topic [${options.topic} failed]`,
      //     );
      //   }
      // });
    } catch (error) {
      this.logger.error(error);
    }
  }

  explore() {
    const providers = this.discoveryService.getProviders();
    providers.forEach(async (wrapper: InstanceWrapper) => {
      const { instance } = wrapper;
      if (!instance) {
        return;
      }

      // scan from instance
      this.metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance)).forEach(key => {
        const subscribeOptions: MqttSubscribeOptions = this.reflector.get(
          MQTT_SUBSCRIBE_OPTIONS,
          instance[key],
        );
        const parameters = this.reflector.get(
          MQTT_SUBSCRIBER_PARAMS,
          instance[key],
        );
        if (subscribeOptions) {
          let replaceOptions = subscribeOptions;
          if (this.options.variables) {
            replaceOptions = this.replacePlaceholders(subscribeOptions, this.options.variables);
          }
          this.subscribe(replaceOptions, parameters, instance[key], instance);
        }
      });
      // this.metadataScanner.scanFromPrototype(
      //   instance,
      //   Object.getPrototypeOf(instance),
      //   key => {
      //     const subscribeOptions: MqttSubscribeOptions = this.reflector.get(
      //       MQTT_SUBSCRIBE_OPTIONS,
      //       instance[key],
      //     );
      //     const parameters = this.reflector.get(
      //       MQTT_SUBSCRIBER_PARAMS,
      //       instance[key],
      //     );
      //     if (subscribeOptions) {
      //       this.subscribe(subscribeOptions, parameters, instance[key], instance);
      //     }
      //   },
      // );
    });
    this.client.on(
      'message',
      (topic: string, payload: Buffer, packet: Packet) => {
        const subscriber = this.getSubscriber(topic);
        if (subscriber) {
          const parameters = subscriber.parameters || [];
          const scatterParameters: MqttSubscriberParameter[] = [];
          for (const parameter of parameters) {
            scatterParameters[parameter.index] = parameter;
          }
          try {
            const transform = getTransform(subscriber.options.transform);

            // add a option to do something before handle message.
            if (this.options.beforeHandle) {
              this.options.beforeHandle(topic, payload, packet);
            }
            subscriber.handle.bind(subscriber.provider)(
              ...scatterParameters.map(parameter => {
                switch (parameter?.type) {
                  case 'payload':
                    return transform(payload);
                  case 'topic':
                    return topic;
                  case 'packet':
                    return packet;
                  case 'params':
                    return MqttExplorer.matchGroups(topic, subscriber.regexp);
                  default:
                    return null;
                }
              }),
            );
          } catch (err) {
            this.logger.error(err);
          }
        }
      },
    );
  }

  private getSubscriber(topic: string): MqttSubscriber | null {
    for (const subscriber of this.subscribers.values()) {
      subscriber.regexp.lastIndex = 0;
      if (subscriber.regexp.test(topic)) {
        return subscriber;
      }
    }
    return null;
  }

  private replacePlaceholders(template: MqttSubscribeOptions, variables: Record<string, string>) {
    let result = template;
    for (const key in variables) {
      const placeholder = '{{' + key + '}}';
      result.topic = (Array.isArray(result.topic) ? result.topic : [result.topic]).map(topic => (topic.replace(placeholder, variables[key])));
    }
    // let result = template.replace(/{{(\w+)}}/g, function (match, p1) {
    //   return variables[p1];
    // });
    return result;
  }

  private static topicToRegexp(topic: string) {
    // compatible with emqtt
    return new RegExp(
      '^' +
      topic
        .replace('$queue/', '')
        .replace(/^\$share\/([A-Za-z0-9]+)\//, '')
        .replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, '\\$1')
        .replace(/\+/g, '([^/]+)')
        .replace(/\/#$/, '(/.*)?') +
      '$',
      'y',
    );
  }

  private static matchGroups(str: string, regex: RegExp) {
    regex.lastIndex = 0;
    let m = regex.exec(str);
    const matches: string[] = [];

    while (m !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex !== 0) {
          matches.push(match);
        }
      });
      m = regex.exec(str);
    }
    return matches;
  }
}
