import logging

from odoo import api, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class MailInjectionQueue(models.Model):
    _name = "mail.injection_queue"
    _description = "Mail Injection Queue"
    _inherit = "mail.thread"

    @api.model
    def assign_message(self, message_id, model, res_id):
        message = self.env["mail.message"].browse(message_id)
        if message.model != "mail.injection_queue":
            raise UserError(self.env._("Message is not in the queue."))

        target = self.env[model].browse(res_id)
        target.check_access("write")

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
        if message.model != "mail.injection_queue":
            raise UserError(self.env._("Message is not in the queue."))
        message.sudo().unlink()
        return True
