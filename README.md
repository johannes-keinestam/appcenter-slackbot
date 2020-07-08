# appcenter-slackbot
A simple self-hosted slack bot which can be asked for AppCenter crash statistics, written in Node.js (w/ express).

This is (for now) specifically designed for checking crashes for Xamarin apps, where there is an Android and an iOS app.
On the host where this is deployed, the following environment variables must be set:

- **ApiToken**: A user AppCenter API token generated from https://appcenter.ms/settings/apitokens. Can be Read Only.
- **AppUsername**: The user that owns the app. Can be found in the URL when browsing AppCenter and clicking an app, e.g. `https://appcenter.ms/users/<AppUsername>/apps/...`.
- **AndroidAppName**: The name of the Android app in AppCenter. Can be found in the URL when browsing AppCenter and clicking the Android app, e.g.`https://appcenter.ms/users/.../apps/<AndroidAppName>/...`.
- **iOSAppName**: The name of the iOS app in AppCenter. Can be found in the URL when browsing AppCenter and clicking the iOS app, e.g.`https://appcenter.ms/users/.../apps/<iOSAppName>/...`.
