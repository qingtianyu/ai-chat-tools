/**
 * 依赖注入容器
 */
export class Container {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
    }

    /**
     * 注册服务
     * @param {string} name 服务名称
     * @param {Function} factory 工厂函数
     * @param {boolean} [singleton=false] 是否单例
     */
    register(name, factory, singleton = false) {
        if (singleton) {
            this.singletons.set(name, {
                factory,
                instance: null
            });
        } else {
            this.services.set(name, factory);
        }
    }

    /**
     * 解析服务
     * @param {string} name 服务名称
     * @returns {*} 服务实例
     */
    resolve(name) {
        // 检查单例
        if (this.singletons.has(name)) {
            const singleton = this.singletons.get(name);
            if (!singleton.instance) {
                singleton.instance = this.createInstance(singleton.factory);
            }
            return singleton.instance;
        }

        // 检查普通服务
        if (this.services.has(name)) {
            return this.createInstance(this.services.get(name));
        }

        throw new Error(`Service ${name} not found`);
    }

    /**
     * 创建服务实例
     * @private
     * @param {Function} factory 工厂函数
     * @returns {*} 服务实例
     */
    createInstance(factory) {
        const dependencies = this.extractDependencies(factory);
        const resolvedDeps = dependencies.map(dep => this.resolve(dep));
        return factory(...resolvedDeps);
    }

    /**
     * 提取依赖
     * @private
     * @param {Function} factory 工厂函数
     * @returns {Array<string>} 依赖名称数组
     */
    extractDependencies(factory) {
        const fnStr = factory.toString();
        const argsStr = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'));
        return argsStr.split(',')
            .map(arg => arg.trim())
            .filter(arg => arg.length > 0);
    }

    /**
     * 注册配置
     * @param {Object} config 配置对象
     */
    registerConfig(config) {
        this.register('config', () => config, true);
    }

    /**
     * 批量注册服务
     * @param {Object} services 服务配置对象
     */
    registerServices(services) {
        Object.entries(services).forEach(([name, config]) => {
            this.register(name, config.factory, config.singleton);
        });
    }

    /**
     * 检查服务是否已注册
     * @param {string} name 服务名称
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name) || this.singletons.has(name);
    }

    /**
     * 移除服务
     * @param {string} name 服务名称
     */
    remove(name) {
        this.services.delete(name);
        this.singletons.delete(name);
    }

    /**
     * 清空容器
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
    }
}
