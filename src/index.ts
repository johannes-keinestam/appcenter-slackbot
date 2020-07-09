const express = require('express');
const bodyParser = require('body-parser');
const request = require('request-promise-native');
const versionCompare = require("node-version-compare");

const apiToken = process.env.ApiToken;
const appUsername = process.env.AppUsername;
const port = process.env.PORT || 5000;

const baseUrl = `https://appcenter.ms/api/v0.1`;

const apps = {
    iOS: process.env.iOSAppName,
    Android: process.env.AndroidAppName
}

function yesterday() {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function maxDaysAgo() {
    return new Date(Date.now() - 89 * 24 * 60 * 60 * 1000); // AppCenter API supports max 90 days ago. Do 89 to be safe.
}

function apiUrl(app) {
    return `${baseUrl}/apps/${appUsername}/${app}`;
}

function requestOptions() {
    return {
        headers: {
            'content-type': 'application/json',
            'x-api-token': apiToken,
        }
    };
}

function crashUrl(app, version, build) {
    return `https://appcenter.ms/users/${appUsername}/apps/${app}/crashes/errors?appBuild=${build}&period=last30Days&status=&version=${version}`;
}

function isSetup() {
    return apps.iOS && apps.Android && apiToken && appUsername;
}

async function getCrashAnalytics(version, droidBuild, iOSBuild) {
    try {
        let result = "";

        const clickableLinkAndroid = `<${crashUrl(apps.Android, version, droidBuild)}|${droidBuild}>`;
        result += `Android (${clickableLinkAndroid}): ${await _getStatsString(apps.Android, version, droidBuild)}\n`;

        const clickableLinkiOS = `<${crashUrl(apps.iOS, version, iOSBuild)}|${iOSBuild}>`;
        result += `iOS (${clickableLinkiOS}): ${await _getStatsString(apps.iOS, version, iOSBuild)}`;

        return result;
    } catch (e) {
        return 'I crashed due to: ' + e;
    }
}

async function _getStatsString(app, version, build) {
    const totalUsers = await _getTotalUsers(app, version);
    const statsSinceLaunch = await _getCrashCount(maxDaysAgo(), app, version, build);
    const statsSinceYesterday = await _getCrashCount(yesterday(), app, version, build);
    const crashesSinceLaunch = statsSinceLaunch[0] + statsSinceLaunch[1];
    const crashesSinceYesterday = statsSinceYesterday[0] + statsSinceYesterday[1];

    const crashGroupsSinceLaunch = await _getCrashGroupCount(app, version, build);

    const affectedUsers = await _getAffectedUsers(maxDaysAgo(), app, version, build);
    const percentageAffectedUsers = ((affectedUsers / totalUsers) * 100).toFixed(1);

    return `${crashesSinceLaunch} crashes (${crashGroupsSinceLaunch} groups) affecting ${percentageAffectedUsers}% of users (${affectedUsers} of ${totalUsers}). ${crashesSinceYesterday} crashes in last 24h.`;
}

async function _getLatestAppBuild(app, version) {
    const url = `${apiUrl(app)}/errors/availableAppBuilds?version=${version}`;
    const response = JSON.parse(await request.get(url, requestOptions()));

    const appBuilds = response['app_builds'].sort(versionCompare).reverse();
    return appBuilds.length > 0 ? appBuilds[0] : null;
}

async function _getAffectedUsers(launchDate, app, version, build) {
    const url = `${apiUrl(app)}/errors/errorGroups?version=${version}&app_build=${build}&start=${encodeURIComponent(launchDate.toISOString())}&errorType=all&$orderby=devices%20desc&$top=30`;
    const response = JSON.parse(await request.get(url, requestOptions()));

    let affectedUsers = 0;
    for (const errorGroup of response.errorGroups) {
        affectedUsers += errorGroup.deviceCount;
    }
    return affectedUsers;
}

async function _getCrashCount(sinceDate, app, version, build) {
    const url = `${apiUrl(app)}/errors/errorCountsPerDay?version=${version}&app_build=${build}&start=${encodeURIComponent(sinceDate.toISOString())}`;

    const crashInfo = await request.get(url + '&errorType=unhandlederror', requestOptions());
    const errorInfo = await request.get(url + '&errorType=handlederror', requestOptions());

    const crashCount = JSON.parse(crashInfo).count;
    const errorCount = JSON.parse(errorInfo).count;

    return [crashCount, errorCount];
}

async function _getTotalUsers(app, version) {
    const url = `${apiUrl(app)}/analytics/versions/?start=${encodeURIComponent(yesterday().toISOString())}&versions=${version}`;
    const response = JSON.parse(await request.get(url, requestOptions()));
    return response.total;
}

async function _getCrashGroupCount(app, version, build) {
    let crashGroups = [];
    let url = `${apiUrl(app)}/errors/errorGroups?version=${version}&app_build=${build}&start=${encodeURIComponent(maxDaysAgo().toISOString())}`;
    while (url) {
        const response = JSON.parse(await request.get(url, requestOptions()));
        crashGroups = crashGroups.concat(response.errorGroups);

        // Handle paginated results
        if (response.nextLink) {
            // If the URL is relative, prefix it with the AppCenter domain.
            url = response.nextLink.startsWith("http") ? response.nextLink : "https://appcenter.ms" + response.nextLink;
        } else {
            url = null;
        }
    }
    return crashGroups.length;
}

async function slackRespondAsync(req, result) {
    if (!isSetup()) {
        return result.send('AppCenterBot is not properly set up. Make sure that the following environment variables have been set on the host: iOSAppName, AndroidAppName, AppUsername, ApiToken.');
    }
    console.log('BODY: ' + JSON.stringify(req.body));
    if (!req.body || !req.body['response_url']) {
        return result.send('No callback URL');
    }
    if (!req.body.text) {
        return result.send("Expected comman parameters, but got none.");
    }

    let version;
    let droidBuild;
    let iOSBuild;

    const splitParams = req.body.text.split(' ');
    if (splitParams.length === 3) {
        [version, droidBuild, iOSBuild] = splitParams;
    } else if (splitParams.length === 1) {
        [version] = splitParams;
    } else {
        return result.send(`Invalid command parameters: "${req.body.text}". Expected either "version" (e.g. "3.2.0"), or "version droid-build ios-build" (e.g. "3.2.0 387 3.2.0.23.0)."`);
    }

    result.json({
        response_type: 'in_channel',
        text: 'Fetching data...',
    });

    if (!droidBuild) {
        droidBuild = await _getLatestAppBuild(apps.Android, version);
    }
    if (!iOSBuild) {
        iOSBuild = await _getLatestAppBuild(apps.iOS, version);
    }
    if (!droidBuild || !iOSBuild) {
        return result.send(`Could not determine latest builds for version ${version}. Try again, or specify them explicitly.`);
    }

    const response = await getCrashAnalytics(version, droidBuild, iOSBuild);
    const requestOptions = {
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            response_type: 'in_channel',
            text: response,
        }),
    };
    await request.post(req.body['response_url'], requestOptions);
}

express()
    .use(bodyParser.urlencoded())
    .post('/slack', async (req, res) => await slackRespondAsync(req, res))
    .listen(port, () => console.log(`Listening on ${port}`));
