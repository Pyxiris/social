import logging

from odoo import http
from odoo.http import request

from odoo.addons.mail_plugin.controllers import mail_plugin

_logger = logging.getLogger(__name__)


class MailPluginController(mail_plugin.MailPluginController):
    @http.route("/mail_plugin/log_mail_raw", type="jsonrpc", auth="outlook", cors="*")
    def log_mail_raw(self, email_raw):
        message = self.env["mail.injection_queue"].decode_raw_message(email_raw)

        # Pre-parse for indexing fields.
        msg_dict = request.env["mail.thread"].message_parse(message)
        queue_model = request.env["mail.injection_queue"]

        create_vals = {
            "subject": msg_dict.get("subject"),
            "email_from": msg_dict.get("email_from"),
            "date": msg_dict.get("date"),
            "raw_message": email_raw,  # Store the original base64 encoded raw message
        }

        queue_item = queue_model.create(create_vals)

        # Notify user via bus to update systray
        request.env["bus.bus"]._sendone(
            request.env.user.partner_id,
            "mail.plugin.log_mail_raw",
            {
                "message_id": queue_item.id,
            },
        )
        return True
