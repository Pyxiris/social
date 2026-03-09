import {Component, useState} from "@odoo/owl";
import {registry} from "@web/core/registry";
import {useService} from "@web/core/utils/hooks";
import {useDiscussSystray} from "@mail/utils/common/hooks";
import {Dropdown} from "@web/core/dropdown/dropdown";
import {DropdownItem} from "@web/core/dropdown/dropdown_item";
import {NotificationItem} from "@mail/core/public_web/notification_item";

export class MailBufferMenu extends Component {
    static template = "mail_attach_to_record.MailBufferMenu";
    static components = {Dropdown, DropdownItem, NotificationItem};

    setup() {
        this.discussSystray = useDiscussSystray();
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState({
            messages: [],
            isLoading: false,
        });
    }

    async beforeOpen() {
        this.state.isLoading = true;
        try {
            this.state.messages = await this.orm.searchRead(
                "mail.message",
                [["model", "=", "mail.buffer"]], // Domain
                ["id", "subject", "email_from", "date"], // Fields
                {limit: 20, order: "date desc"}
            );
        } finally {
            this.state.isLoading = false;
        }
    }

    async attachMessage(message) {
        const currentController = this.action.currentController;
        const props = currentController ? currentController.props : {};
        // Attempt to find the active record in the current view
        const resModel = props.resModel || props.res_model;
        const resId = props.resId || props.res_id;
        if (resModel && resId) {
            try {
                await this.orm.call("mail.buffer", "assign_message", [
                    message.id,
                    resModel,
                    resId,
                ]);
                this.notification.add("Email attached successfully.", {
                    type: "success",
                });
                // Remove the attached message from the list immediately
                this.state.messages = this.state.messages.filter(
                    (m) => m.id !== message.id
                );
                // Refresh the view to show the new message in the chatter
                await this.action.doAction({
                    type: "ir.actions.client",
                    tag: "reload",
                });
            } catch (e) {
                this.notification.add("Failed to attach email.", {
                    type: "danger",
                });
            }
        } else {
            this.notification.add(
                "Please open a record form view to attach the email.",
                {type: "warning"}
            );
        }
    }

    /**
     * Example property to get the counter for your icon's badge.
     * This logic is now cleanly encapsulated in your component.
     */
    get mailBufferCounter() {
        return this.state.messages.length;
    }
}

registry.category("systray").add("mail_attach_to_record.mail_buffer_menu", {
    Component: MailBufferMenu,
    sequence: 25,
});
