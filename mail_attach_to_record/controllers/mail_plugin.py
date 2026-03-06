import base64
import email
import email.policy
import logging

from odoo import http
from odoo.exceptions import AccessError
from odoo.http import request

from odoo.addons.mail_plugin.controllers import mail_plugin

_logger = logging.getLogger(__name__)


class MailPluginController(mail_plugin.MailPluginController):
    @http.route("/mail_plugin/log_mail_raw", type="jsonrpc", auth="outlook", cors="*")
    def log_mail_raw(self, model, res_id, email_raw):
        # 1. Find the record (Model + ID)
        if model not in request.env:
            return {"error": "Invalid model"}

        record = request.env[model].browse(res_id).exists()
        if not record:
            return {"error": "Record not found"}

        try:
            record.check_access_rights("write")
            record.check_access_rule("write")
        except AccessError:
            return {"error": "Access denied"}

        # 2. Parse the raw email
        message = email.message_from_bytes(
            base64.b64decode(email_raw), policy=email.policy.SMTP
        )
        msg_dict = request.env["mail.thread"].message_parse(message)

        # 3. Post the message to the record's chatter
        subtype_xmlid = (
            "mail.mt_note" if msg_dict.get("is_internal") else "mail.mt_comment"
        )
        record.message_post(
            body=msg_dict.get("body"),
            subject=msg_dict.get("subject"),
            message_type="email",
            subtype_xmlid=subtype_xmlid,
            parent_id=msg_dict.get("parent_id"),
            email_from=msg_dict.get("from"),
            incoming_email_to=msg_dict.get("to"),
            incoming_email_cc=msg_dict.get("cc"),
            date=msg_dict.get("date"),
            message_id=msg_dict.get("message_id"),
            author_id=msg_dict.get("author_id"),
            attachments=msg_dict.get("attachments"),
        )
        return True
