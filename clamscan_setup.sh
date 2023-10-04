#!/bin/bash

sudo apt-get update
sudo apt-get install clamav clamav-daemon
sudo freshclam
sudo service clamav-freshclam start