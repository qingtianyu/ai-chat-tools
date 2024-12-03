/**
 * 事件发射器实现
 */
export class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    /**
     * 注册事件监听器
     * @param {string} event 事件名称
     * @param {Function} listener 监听器函数
     */
    on(event, listener) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(listener);
    }

    /**
     * 注册一次性事件监听器
     * @param {string} event 事件名称
     * @param {Function} listener 监听器函数
     */
    once(event, listener) {
        const onceWrapper = (...args) => {
            listener(...args);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
    }

    /**
     * 移除事件监听器
     * @param {string} event 事件名称
     * @param {Function} listener 监听器函数
     */
    off(event, listener) {
        if (!this.events.has(event)) {
            return;
        }
        const listeners = this.events.get(event);
        const index = listeners.indexOf(listener);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * 移除所有事件监听器
     * @param {string} [event] 事件名称（可选）
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * 触发事件
     * @param {string} event 事件名称
     * @param {...*} args 事件参数
     */
    emit(event, ...args) {
        if (!this.events.has(event)) {
            return;
        }
        const listeners = this.events.get(event);
        listeners.forEach(listener => {
            try {
                listener(...args);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    /**
     * 获取事件监听器数量
     * @param {string} event 事件名称
     * @returns {number}
     */
    listenerCount(event) {
        if (!this.events.has(event)) {
            return 0;
        }
        return this.events.get(event).length;
    }

    /**
     * 获取所有事件名称
     * @returns {Array<string>}
     */
    eventNames() {
        return Array.from(this.events.keys());
    }
}
