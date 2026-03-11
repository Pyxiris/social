# Copyright 2026 Liam Noonan
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    "name": "Mail Plugin inject raw mail to chatter",
    "summary": "Use mail client extensions to inject mail to chatter",
    "version": "19.0.1.0.0",
    "author": "Pyxiris, Odoo Community Association (OCA)",
    "license": "AGPL-3",
    "category": "Mail",
    "website": "https://github.com/OCA/social",
    "depends": [
        "mail",
        "mail_plugin",
    ],
    "installable": True,
    "data": [
        "security/ir.model.access.csv",
    ],
    "assets": {
        "web.assets_backend": [
            "mail_plugin_inject_raw/static/src/js/mail_injection_queue.esm.js",
            "mail_plugin_inject_raw/static/src/xml/mail_injection_queue.xml",
        ],
    },
}
