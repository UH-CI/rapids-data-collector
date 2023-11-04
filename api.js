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

function getHawaiiISOTimestamp(timestamp) {
    if(!timestamp) {
        timestamp = new Date();
    }
    
    //subtract 10 hours so utc converted time will be in hawaii timezone
    timestamp.setHours(timestamp.getHours() - 10);
    //remove Z from iso string and replace with tz offset
    timestampString = timestamp.toISOString().slice(0, -1) + "-10:00";
    return timestampString;
}

function gpsStrToCoord(gpsStr) {
    coord = "";
    let coordPattern = /([0-9]+)\s+deg\s+([0-9]+)'\s+([0-9]+(?:.[0-9]+)?)/;
    let match = gpsStr.match(coordPattern);
    if(match) {
        let deg = Number(match[1]);
        let min = Number(match[2]);
        let sec = Number(match[3]);
        latN = deg + (min / 60.0) + (sec / 3600.0);
        coord = latN.toString();
    }
    return coord;
}

function exifDatetimeToHawaiiISOTimestamp(exifTimestamp) {
    timestamp = "";
    let datetimePattern = /([0-9]{4}):([0-9]{2}):([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})(?:.[0-9]+)?((?:[-+][0-9]{2}:[0-9]{2})|Z)?/;
    let match = exifTimestamp.match(datetimePattern);
    if(match) {
        let year = match[1];
        let month = match[2];
        let day = match[3];
        let hour = match[4];
        let min = match[5];
        let sec = match[6];
        let tz = match[7];
        if(!tz) {
            tz = "Z";
        }
        isoTimestamp = `${year}-${month}-${day}T${hour}:${min}:${sec}${tz}`;
        console.log(isoTimestamp);
        timestamp = getHawaiiISOTimestamp(new Date(isoTimestamp));
    }
    return timestamp;
}

function parseMetadataFields(metadata) {
    parsedMetadata = {};
    let { gpsLatitude, gpsLongitude, createDate } = metadata;
    if(gpsLatitude) {
        parsedMetadata.fileLat = gpsStrToCoord(gpsLatitude);
    }
    if(gpsLongitude) {
        parsedMetadata.fileLng = "-" + gpsStrToCoord(gpsLongitude);
    }
    if(createDate) {
        parsedMetadata.fileTimestamp = exifDatetimeToHawaiiISOTimestamp(createDate);
    }
    return parsedMetadata;
}

app.post("/upload", upload.single("file"), async (req, res) => {
    let { id, ext, fname, email, lat, lng, description, userTimestamp } = req.body;
    const originalFname = req.file?.originalname;
    if(id === undefined) {
        id = Date.now();
    }
    const uploadTimestamp = getHawaiiISOTimestamp();
    let metadata = {};
    if(fname) {
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
    
        try {
            const imgbuffer = await fs.promises.readFile(fpath);
            metadata = await new Promise((resolve, reject) => {
                exif.metadata(imgbuffer, (err, metadata) => {
                    if(err) {
                        reject(err)
                    }
                    else {
                        //parse metadata to standard json object, stored in strange format that cannot be stringified
                        let metadataObj = {}
                        for(let tag in metadata) {
                            metadataObj[tag] = metadata[tag];
                        }

                        resolve(metadataObj);
                    }
                });
            });
        }
        catch(err) {
            console.error(`Failed to get exif data for file ${fpath}. Failed with error: ${err}`);
        }
    }

    let parsedFields = parseMetadataFields(metadata);
    let { fileLat, fileLng, fileTimestamp } = parsedFields;
    
    await docLoaded;
    const sheet = doc.sheetsByIndex[0];
    sheet.addRow({
        id,
        ext,
        fname,
        originalFname,
        email,
        userLat: lat,
        userLng: lng,
        fileLat,
        fileLng,
        description,
        userTimestamp,
        fileTimestamp,
        uploadTimestamp,
        metadata: JSON.stringify(metadata)
    });
    res.sendStatus(200);
});