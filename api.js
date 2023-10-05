const multer = require("multer");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const config = require("./config.json");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const NodeClam = require('clamscan');
const path = require('path');

process.env["NODE_ENV"] = "production";

const ClamScan = new NodeClam().init({
    removeInfected: true
});

const serviceAccountAuth = new JWT({
    email: config.client_email,
    key: config.private_key,
    scopes: config.scopes
});

const doc = new GoogleSpreadsheet(config.sheet_id, serviceAccountAuth);
const docLoaded = doc.loadInfo();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.storage);
    },
    filename: (req, file, cb) => {
        const uuid = uuidv4();
        req.body.uuid = uuid;
        cb(null, uuid);
    }
});

const upload = multer({ storage: storage });

const app = express();

app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
});

app.post("/upload", upload.single("file"), async (req, res) => {
    const { uuid, email, lat, lng, description } = req.body;
    const originalFname = req.file?.originalname;

    if(email === undefined || lat === undefined || lng === undefined || description === undefined || originalFname === undefined) {
        console.log(req.file, email, lat, lng, description, req, req.body);
        return res.status(400)
        .send(
            `Request body must include the following data:
            file: The file to upload.
            email: Email address of the user uploading the file.
            description: A description of the file.
            lat: The latitude of the image.
            lng: The longitude of the image`
        );
    }

    const timestamp = new Date().toISOString();

    try {
        const clamscan = await ClamScan;
        let fpath = path.join(config.storage, uuid);
        const {isInfected, file, viruses} = await clamscan.isInfected(fpath);
        if(isInfected) {
            //anything else?
            console.log(`${file} is infected with ${viruses}! The file has been removed.`);
            return res.status(415)
            .send(
                "The uploaded file was infected and could not be processed"
            );
        }
    }
    //if there was an error scanning the file just accept it
    catch (err) {
        console.error(`Failed to scan uploaded file. Virus scan failed with error: ${err}`);
    }

    await docLoaded;
    const sheet = doc.sheetsByIndex[0];
    sheet.addRow({
        uuid,
        originalFname,
        email,
        lat,
        lng,
        description,
        timestamp
    });
    res.sendStatus(200);
})