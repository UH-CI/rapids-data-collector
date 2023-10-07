const multer = require("multer");
const express = require("express");
const compression = require("compression");
const config = require("./config.json");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const NodeClam = require('clamscan');
const path = require('path');
const exif = require("exiftool");
const fs = require("fs");

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
        const id = Date.now();
        let ext = "";
        if(file?.originalname) {
            ext = path.extname(file.originalname)
        }
        const fname = `${id}${ext}`;
        req.body.id = id;
        req.body.ext = ext;
        req.body.fname = fname;
        cb(null, fname);
    }
});

const upload = multer({ storage: storage });

const app = express();

app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
});

//compress all HTTP responses
app.use(compression());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  //pass to next layer
  next();
});

app.post("/upload", upload.single("file"), async (req, res) => {
    const { id, ext, fname, email, lat, lng, description, userTimestamp } = req.body;
    const originalFname = req.file?.originalname;

    if(email === undefined || lat === undefined || lng === undefined || description === undefined || originalFname === undefined) {
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

    const uploadTimestamp = new Date().toISOString();
    let fpath = path.join(config.storage, fname);
    try {
        const clamscan = await ClamScan;
        
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
    catch(err) {
        console.error(`Failed to scan uploaded file ${fpath}. Virus scan failed with error: ${err}`);
    }

    let metadata = "{}";
    try {
        const imgbuffer = await fs.promises.readFile(fpath);
        exif.metadata(imgbuffer, (err, metadata) => {
            if(err) {
                console.error(`Failed to get exif data from ${fpath}. Failed with error: ${err}`);
            }
            else {
                //parse metadata to standard json object, stored in strange format that cannot be stringified
                let metadataObj = {}
                for(let tag in metadata) {
                    metadataObj[tag] = metadata[tag];
                }
                metadata = JSON.stringify(metadataObj);
            }
        });
    }
    catch(err) {
        console.error(`Failed to load file ${fpath} and get exif data. Failed with error: ${err}`);
    }
    

    await docLoaded;
    const sheet = doc.sheetsByIndex[0];
    sheet.addRow({
        id,
        ext,
        fname,
        originalFname,
        email,
        lat,
        lng,
        description,
        userTimestamp,
        uploadTimestamp,
        metadata
    });
    res.sendStatus(200);
});