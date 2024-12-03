/**
 * 实体基类
 */
export class Entity {
    constructor(id) {
        if (!id) {
            throw new Error('Entity must have an id');
        }
        this._id = id;
    }

    get id() {
        return this._id;
    }

    equals(entity) {
        if (!(entity instanceof Entity)) {
            return false;
        }
        return this._id === entity.id;
    }
}
