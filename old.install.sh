#!/usr/bin/env bash

sudo apt-get upgrade
sudo apt-get update
sudo apt-get -y install build-essential nodejs npm
sudo ln -s /usr/bin/nodejs /usr/bin/node
sudo npm install