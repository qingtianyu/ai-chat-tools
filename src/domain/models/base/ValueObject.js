/**
 * 值对象基类
 */
export class ValueObject {
    /**
     * 判断两个值对象是否相等
     * @param {ValueObject} other 另一个值对象
     * @returns {boolean} 是否相等
     */
    equals(other) {
        if (!(other instanceof ValueObject)) {
            return false;
        }
        return JSON.stringify(this) === JSON.stringify(other);
    }

    /**
     * 创建值对象的副本
     * @returns {ValueObject} 值对象副本
     */
    clone() {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }
}
