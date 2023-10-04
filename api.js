const multer = require("multer");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const config = require("./config.json");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const NodeClam = require('clamscan');
const path = require('path');

const ClamScan = new NodeClam().init();

const serviceAccountAuth = new JWT({
    email: config.client_email,
    key: config.private_key,
    scopes: config.scopes
});

const doc = new GoogleSpreadsheet(config.sheet_id, serviceAccountAuth);


// process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
// process.env["NODE_ENV"] = "production";

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
// const server = https.createServer(options, app)
// .listen(port, (err) => {
//   if(err) {
//     console.error(error);
//   }
//   else {
//     console.log("Server listening at port " + port);
//   }
// });
app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
});

app.post("/upload", upload.single("file"), async (req, res) => {
    const { uuid, email, lat, lng, description } = req.body;
    const originalFname = req.file.originalname;

    try {
        const clamscan = await ClamScan;

        const {isInfected, file, viruses} = await clamscan.isInfected(path.join(config.storage, uuid));
        if (isInfected) {
            //anything else?
            console.log(`${file} is infected with ${viruses}!`);
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

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    sheet.addRow({
        uuid,
        originalFname,
        email,
        lat,
        lng,
        description
    });
    res.sendStatus(200);
})