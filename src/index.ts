import express from "express";
import bodyParser from 'body-parser';
import AppCenterSlackBot from './AppCenterSlackBot';

export const apiToken = process.env.ApiToken;
export const appUsername = process.env.AppUsername;
const port = process.env.PORT || 5000;

export const apps = {
    iOS: process.env.iOSAppName,
    Android: process.env.AndroidAppName
}

express()
    .use(bodyParser.urlencoded())
    .post('/slack', async (req, res) => await new AppCenterSlackBot().onSlashCommand(req, res))
    .listen(port, () => console.log(`Listening on ${port}`));
