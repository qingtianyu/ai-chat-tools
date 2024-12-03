import app from './app.js';
import { Logger } from './infrastructure/logging/Logger.js';

const logger = new Logger();

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

async function startServer() {
    try {
        await app.initialize();
        await app.start();
        
        logger.info('Server started successfully');
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
