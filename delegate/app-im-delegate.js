import {getIMHandlerFactory} from "../libs/im-sdk/im-factory";

export default class AppIMDelegate {
    constructor(app) {
        this._app = app;
    }

    onLaunch(options) {
        this.iIMHandler = getIMHandlerFactory;
    }

    onShow(options) {
        this.iIMHandler.createConnection({});
    }

    onHide() {
        this.iIMHandler.closeConnection();
    }

    getIMHandlerDelegate() {
        return this.iIMHandler;
    }
}
