import { ConsoleLogger } from '@nestjs/common';

// Keep test output readable: the filter logs every 500 it hides, and Nest's TestingLogger
// (a ConsoleLogger) prints all errors. Tests that check the log spy on Logger.prototype.error,
// which still sees each call.
vi.spyOn(ConsoleLogger.prototype, 'error').mockImplementation(() => {});
