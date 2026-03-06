/**
 * Entry point: Executed when an email is opened.
 */
function onGmailMessageOpen(event) {
  var accessToken = getAccessToken();
  var odooUrl = getOdooServerUrl();

  // If not logged in, show the login card
  if (!accessToken || !odooUrl) {
    return buildLoginCard();
  }

  // If logged in, show the "Attach" card
  return buildAttachCard(event);
}

/**
 * Builds the main card with the URL input field.
 */
function buildAttachCard(event) {
  var card = CardService.newCardBuilder();
  var section = CardService.newCardSection();

  // Input for Odoo Model
  var modelInput = CardService.newTextInput()
    .setFieldName("model")
    .setTitle("Model Name")
    .setHint("e.g. crm.lead");

  var idInput = CardService.newTextInput()
    .setFieldName("res_id")
    .setTitle("Record ID")
    .setHint("e.g. 123");

  // The Attach Button
  var action = CardService.newAction()
    .setFunctionName("onAttachClick")
    .setParameters({
      messageId: event.gmail.messageId,
      accessToken: event.gmail.accessToken
    });

  var button = CardService.newTextButton()
    .setText("Attach to Document")
    .setBackgroundColor("#875A7B")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(action);

  section.addWidget(modelInput);
  section.addWidget(idInput);
  section.addWidget(button);

  // Logout button for convenience
  var logoutAction = CardService.newAction().setFunctionName("onLogout");
  section.addWidget(CardService.newTextButton().setText("Logout").setOnClickAction(logoutAction));

  card.addSection(section);
  return card.build();
}

/**
 * Handles the button click to attach the email.
 */
function onAttachClick(e) {
  var model = e.formInput.model;
  var resId = parseInt(e.formInput.res_id);

  if (!model || !resId) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Please provide both Model and ID."))
      .build();
  }

  // --- ADD THESE DEFINITIONS ---
  var odooUrl = getOdooServerUrl();
  var odooToken = getAccessToken();
  var endpoint = odooUrl + "/mail_plugin/log_mail_raw";
  // -----------------------------

  // 2. Fetch Email Content
  var messageId = e.parameters.messageId;
  var accessToken = e.parameters.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);
  var message = GmailApp.getMessageById(messageId);

  var rawContent = message.getRawContent();
  // Encode to Base64 to prevent character corruption during transit
  var base64Content = Utilities.base64Encode(rawContent);

  var payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: model,
      res_id: resId,
      email_raw: base64Content // Send the encoded version
    },
    id: Math.floor(Math.random() * 1000)
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + odooToken }, // odooToken is now defined!
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, options); // endpoint is now defined!
    var json = JSON.parse(response.getContentText());

    if (json.error) {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText("Odoo Error: " + JSON.stringify(json.error)))
        .build();
    }

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Successfully attached email."))
      .build();

  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Connection Error: " + err.message))
      .build();
  }
}

// --- Authentication & Helper Functions (Simplified from original) ---

function buildLoginCard() {
  var card = CardService.newCardBuilder();
  var section = CardService.newCardSection();

  section.addWidget(CardService.newImage().setImageUrl("https://www.odoo.com/web/image/website/1/logo/Odoo"));

  section.addWidget(CardService.newTextInput()
    .setFieldName("odooServerUrl")
    .setTitle("Odoo Database URL")
    .setHint("https://mycompany.odoo.com")
    .setValue(PropertiesService.getUserProperties().getProperty("ODOO_SERVER_URL") || ""));

  section.addWidget(CardService.newTextButton()
    .setText("Login")
    .setOnClickAction(CardService.newAction().setFunctionName("onLoginClick")));

  card.addSection(section);
  return card.build();
}

function onLoginClick(e) {
  var url = e.formInput.odooServerUrl;
  if (!url) return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("URL required")).build();

  // Normalize URL
  // Force HTTPS for security
  url = url.replace(/^http:\/\//i, 'https://');
  if (url.indexOf("https://") !== 0) url = "https://" + url;
  url = url.replace(/\/+$/, ""); // remove trailing slash

  PropertiesService.getUserProperties().setProperty("ODOO_SERVER_URL", url);

  // Generate Auth URL
  var scriptId = ScriptApp.getScriptId();
  var stateToken = ScriptApp.newStateToken().withMethod("odooAuthCallback").withTimeout(3600).createToken();
  var redirectUrl = "https://script.google.com/macros/d/" + scriptId + "/usercallback";

  var authUrl = url + "/mail_plugin/auth?redirect=" + encodeURIComponent(redirectUrl) +
                "&friendlyname=Gmail&scope=outlook&state=" + stateToken;

  return CardService.newActionResponseBuilder()
    .setOpenLink(CardService.newOpenLink().setUrl(authUrl).setOpenAs(CardService.OpenAs.OVERLAY))
    .build();
}

function odooAuthCallback(request) {
  var authCode = request.parameter.auth_code;
  var odooUrl = PropertiesService.getUserProperties().getProperty("ODOO_SERVER_URL");

  // Exchange code for token
  var payload = {
    jsonrpc: "2.0",
    method: "call",
    params: { auth_code: authCode },
    id: 1
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };

  try {
    var response = UrlFetchApp.fetch(odooUrl + "/mail_plugin/auth/access_token", options);
    var json = JSON.parse(response.getContentText());

    if (json.result && json.result.access_token) {
      PropertiesService.getUserProperties().setProperty("ODOO_ACCESS_TOKEN", json.result.access_token);
      return HtmlService.createHtmlOutput("Success! You can close this window and refresh the add-on.");
    } else {
      return HtmlService.createHtmlOutput("Error: Could not retrieve access token.");
    }
  } catch (e) {
    return HtmlService.createHtmlOutput("Error connecting to Odoo: " + e.message);
  }
}

function onLogout() {
  PropertiesService.getUserProperties().deleteProperty("ODOO_ACCESS_TOKEN");
  return onGmailMessageOpen(null); // Reload view
}

function getAccessToken() {
  return PropertiesService.getUserProperties().getProperty("ODOO_ACCESS_TOKEN");
}

function getOdooServerUrl() {
  return PropertiesService.getUserProperties().getProperty("ODOO_SERVER_URL");
}
