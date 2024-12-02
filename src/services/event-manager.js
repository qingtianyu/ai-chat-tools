import EventEmitter from 'events';

class EventManager extends EventEmitter {
    constructor() {
        super();
        // 从环境变量读取调试状态
        this.debug = process.env.DEBUG === 'true';
    }

    emit(event, ...args) {
        if (this.debug) {
            console.log(`[Event] ${event}:`, ...args);
        }
        super.emit(event, ...args);
    }
}

// 单例模式
const eventManager = new EventManager();
export default eventManager;
