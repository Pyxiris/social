/** @odoo-module */

import {NotificationItem} from "@mail/core/public_web/notification_item";

export class DeletableNotificationItem extends NotificationItem {
    static template = "mail_plugin_inject_raw.DeletableNotificationItem";
    static props = {
        ...NotificationItem.props,
        onDelete: {type: Function, optional: true},
    };
}
