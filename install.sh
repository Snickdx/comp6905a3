#!/usr/bin/env bash
workserver_path=/home/admin806003586/workserver
sudo echo $workserver_path
sudo mkdir $workserver_path
cd $workserver_path

sudo apt-get upgrade
sudo apt-get -y update
sudo apt-get -y install build-essential git nodejs npm
sudo ln -s /usr/bin/nodejs /usr/bin/node
git clone https://github.com/Snickdx/comp6905a3.git
cd comp6905a3
sudo npm install
sudo forever start ''$workserver_path'/comp6905a3/sender.js'
sudo forever list