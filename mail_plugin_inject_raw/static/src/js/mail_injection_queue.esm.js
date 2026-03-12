/** @odoo-module */

import {Component, onWillStart, useEffect, useState} from "@odoo/owl";
import {DeletableNotificationItem} from "./deletable_notification_item.esm";
import {Dropdown} from "@web/core/dropdown/dropdown";
import {DropdownItem} from "@web/core/dropdown/dropdown_item";
import {registry} from "@web/core/registry";
import {useDiscussSystray} from "@mail/utils/common/hooks";
import {useDropdownState} from "@web/core/dropdown/dropdown_hooks";
import {useService} from "@web/core/utils/hooks";
import {user} from "@web/core/user";
import {hasTouch} from "@web/core/browser/feature_detection";

export class MailInjectionQueueMenu extends Component {
    static template = "mail_plugin_inject_raw.MailInjectionQueueMenu";
    static components = {Dropdown, DropdownItem, DeletableNotificationItem};

    setup() {
        super.setup();
        this.discussSystray = useDiscussSystray();
        this.dropdown = useDropdownState();
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.busService = useService("bus_service");
        this.store = useService("mail.store");
        this.state = useState({
            messages: [],
            isLoading: false,
        });
        this.hasTouch = hasTouch;

        onWillStart(() => this.fetchMessages());

        useEffect(
            () => {
                const unsubscribe = this.busService.subscribe(
                    "mail.plugin.log_mail_raw",
                    () => this.fetchMessages()
                );
                return unsubscribe;
            },
            () => []
        );
    }

    async fetchMessages() {
        this.state.isLoading = true;
        try {
            this.state.messages = await this.orm.searchRead(
                "mail.message",
                [
                    ["model", "=", "mail.injection_queue"],
                    ["create_uid", "=", user.userId],
                ],
                ["id", "subject", "email_from", "date"],
                {limit: 100, order: "date desc"}
            );
        } finally {
            this.state.isLoading = false;
        }
    }

    async beforeOpen() {
        await this.fetchMessages();
    }

    async attachMessage(message) {
        const controller = this.action.currentController;
        const resModel = controller?.action.res_model;
        const resIdRaw = controller?.currentState?.resId;
        const resId = resIdRaw && typeof resIdRaw === "number" ? resIdRaw : undefined;

        this.dropdown.close();

        if (resModel && resId) {
            try {
                await this.orm.call("mail.injection_queue", "assign_message", [
                    message.id,
                    resModel,
                    resId,
                ]);
                this.notification.add("Email attached successfully.", {
                    type: "success",
                });
                // Remove the attached message from the list
                this.state.messages = this.state.messages.filter(
                    (m) => m.id !== message.id
                );
                // Refresh the view to show the new message in the chatter
                const thread = this.store.Thread.get({model: resModel, id: resId});
                if (thread) {
                    await thread.loadAround(message.id);
                }
            } catch {
                this.notification.add("Failed to attach email.", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add(
                "Please open a record form view to attach the email.\nIf open already, try reloading the page.",
                {type: "warning"}
            );
        }
    }

    async deleteMessage(message) {
        try {
            await this.orm.call("mail.injection_queue", "discard_message", [
                message.id,
            ]);
            this.state.messages = this.state.messages.filter(
                (m) => m.id !== message.id
            );
            this.notification.add("Message deleted.", {type: "success"});
        } catch {
            this.notification.add("Failed to delete message.", {type: "danger"});
        }
    }

    /**
     * Example property to get the counter for your icon's badge.
     * This logic is now cleanly encapsulated in your component.
     */
    get MailInjectionQueueCounter() {
        return this.state.messages.length;
    }
}

registry.category("systray").add("mail_plugin_inject_raw.mail_injection_queue_menu", {
    Component: MailInjectionQueueMenu,
    sequence: 25,
});
