# NestJS-MQTT

## Description

A MQTT module for Nest.js. Compatible with emqtt.

## Installation

> ⚠️ After version 0.2.0, `nestjs-mqtt` make a breaking change. User should add additional `mqtt` package manual.
> @nestjs/core and @nestjs/common version >= 10.0.0 is required.

```bash
$ npm install nestjs-mqtt mqtt --save
```

## Usage

### Import

nestjs-mqtt will register as a global module.

You can import with configuration

> version 1.3.0 新增 topic 动态传参

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MqttModule } from 'nestjs-mqtt';

@Module({
  imports: [MqttModule.forRoot({
    url: 'mqtt://localhost:1883',
    options: {
      ...,
      variables: {
        hello: 'test'
      }
    }
  })]
})
export class AppModule {}

import { Injectable } from '@nestjs/common';
import { Subscribe, Payload, Topic } from 'nestjs-mqtt';

@Injectable()
export class TestService {
  @Subscribe('{{hello}}/test')
  test() {

  }

  @Subscribe({
    topic: '{{hello}}/test2',
    transform: payload => payload.toString(),
  })
  test2() {

  }
}
```

> version 1.2.0 新增 动态加载配置文件建立连接，配置文件为json，文件内容为mqtt连接配置

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MqttModule } from 'nestjs-mqtt';

@Module({
  imports: [
    MqttModule.forRoot({
      url: 'mqtt://localhost:1883',
      options: {
        load: 'filename',
      },
    }),
  ],
})
export class AppModule {}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MqttModule } from 'nestjs-mqtt';

@Module({
  imports: [MqttModule.forRoot(options)],
})
export class AppModule {}
```

or use async import method

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MqttModule } from 'nestjs-mqtt';

@Module({
  imports: [
    MqttModule.forRootAsync({
      useFactory: () => options,
    }),
  ],
})
export class AppModule {}
```

### Subscribe

You can define any subscriber or consumer in any provider. For example,

```typescript
import { Injectable } from '@nestjs/common';
import { Subscribe, Payload, Topic } from 'nestjs-mqtt';

@Injectable()
export class TestService {
  @Subscribe('test')
  test() {}

  @Subscribe({
    topic: 'test2',
    transform: (payload) => payload.toString(),
  })
  test2() {}
}
```

Also, you can inject parameter with decorator:

```typescript
import { Injectable } from '@nestjs/common';
import { Subscribe, Payload } from 'nestjs-mqtt';

@Injectable()
export class TestService {
  @Subscribe('test')
  test(@Payload() payload) {
    console.log(payload);
  }
}
```

Here are all supported parameter decorators:

#### Payload(transform?: (payload) => any)

Get the payload data of incoming message. You can pass in a transform function for converting.

#### Topic()

Get the topic of incoming message.

#### Packet()

Get the raw packet of incoming message.

#### Params()

Get the wildcard part of topic. It will return an array of string which extract from topic. For example:

When subscribe the topic "test/+/test/+" and incoming topic is "test/1/test/2", you will get the array `["1", "2"]`.

### Publish

nestjs-mqtt wrap some functions with `Promise` and provide a provider.

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { MqttService } from 'nestjs-mqtt';

@Injectable()
export class TestService {
  constructor(@Inject(MqttService) private readonly mqttService: MqttService) {}

  async testPublish() {
    this.mqttService.publish('topic', {
      foo: 'bar',
    });
  }
}
```

## Emqtt Compatible

nestjs-mqtt support emq shared subscription

- Global mode

Module options support queue and share property for globally converting all topic to shared topic except configured in subscription options.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MqttModule } from 'nestjs-mqtt';

@Module({
  imports: [
    MqttModule.forRoot({
      host: '127.0.0.1',
      queue: true,
      share: 'group1',
    }),
  ],
})
export class AppModule {}
```

- Configure in Subscribe

```typescript
import { Injectable } from '@nestjs/common';
import { Subscribe, Payload, Topic } from 'nestjs-mqtt';

@Injectable()
export class TestService {
  @Subscribe('test')
  test() {}

  @Subscribe({
    topic: 'test2',
    queue: true,
  })
  test2() {}
}
```

The priority of subscribe is higher than the global mode. If you want to specify a topic do not use the shared mode, set it as false in subscribe decorator.

## Support

nestjs-mqtt is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## License

nestjs-mqtt is [MIT licensed](LICENSE).
