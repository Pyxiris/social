import logging

from odoo import api, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class MailBuffer(models.Model):
    _name = "mail.buffer"
    _description = "Mail Buffer"
    _inherit = "mail.thread"

    @api.model
    def assign_message(self, message_id, model, res_id):
        message = self.env["mail.message"].browse(message_id)
        if message.model != "mail.buffer":
            raise UserError("Message is not in the buffer.")

        target = self.env[model].browse(res_id)
        target.check_access_rights("write")
        target.check_access_rule("write")

        message.sudo().write(
            {
                "model": model,
                "res_id": res_id,
            }
        )
        return True

    @api.model
    def discard_message(self, message_id):
        message = self.env["mail.message"].browse(message_id)
        if message.model != "mail.buffer":
            raise UserError("Message is not in the buffer.")
        message.sudo().unlink()
        return True
