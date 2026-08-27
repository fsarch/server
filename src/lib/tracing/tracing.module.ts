import {
  Global,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { shutdownTracing } from './tracing.js';

@Injectable()
class TracingShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTracing();
  }
}

@Global()
@Module({
  providers: [TracingShutdownService],
})
export class TracingModule {}
