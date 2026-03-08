/** @odoo-module **/

import {registry} from "@web/core/registry";

export const mailPluginNotificationService = {
    dependencies: ["bus_service", "notification", "action", "orm"],
    start(env, {bus_service, notification, action, orm}) {
        bus_service.subscribe("mail.plugin.log_mail_raw", (payload) => {
            const messageId = payload.message_id;
            const closeNotification = notification.add(
                "New email received. Click to attach to open record.",
                {
                    title: "Email Received",
                    type: "info",
                    sticky: true,
                    buttons: [
                        {
                            name: "Attach",
                            primary: true,
                            onClick: async () => {
                                const currentController = action.currentController;
                                const props = currentController
                                    ? currentController.props
                                    : {};
                                const resModel = props.resModel || props.res_model;
                                const resId = props.resId || props.res_id;

                                // Check if we are in a view that has a record open (Form view)
                                if (resModel && resId) {
                                    try {
                                        await orm.call(
                                            "mail.buffer",
                                            "assign_message",
                                            [messageId, resModel, resId]
                                        );
                                        notification.add(
                                            "Email attached successfully.",
                                            {type: "success"}
                                        );
                                        // Refresh the view to show the new message in chatter
                                        await action.doAction({
                                            type: "ir.actions.client",
                                            tag: "reload",
                                        });
                                    } catch (e) {
                                        notification.add("Failed to attach email.", {
                                            type: "danger",
                                        });
                                    }
                                } else {
                                    notification.add(
                                        "Please open a record form view to attach the email.",
                                        {type: "warning"}
                                    );
                                }
                                closeNotification();
                            },
                        },
                        {
                            name: "Discard",
                            onClick: async () => {
                                try {
                                    await orm.call("mail.buffer", "discard_message", [
                                        messageId,
                                    ]);
                                    notification.add("Email discarded.", {
                                        type: "info",
                                    });
                                } catch (e) {
                                    notification.add("Failed to discard email.", {
                                        type: "danger",
                                    });
                                }
                                closeNotification();
                            },
                        },
                    ],
                }
            );
        });
    },
};

registry
    .category("services")
    .add("mailPluginNotification", mailPluginNotificationService);
