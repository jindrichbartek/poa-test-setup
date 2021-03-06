const fs = require('fs');
const utils = require("./utils/utils");
const Constants = require("./utils/constants");
const constants = Constants.constants;
const { generateAddress } = require("./utils/utils");
const dir = require('node-dir');
const path = require('path');
let faker = require('faker/locale/en');
let moment = require('moment');
const generatePassword = require('password-generator');
const webdriver = require('selenium-webdriver'),
      chrome = require('selenium-webdriver/chrome');
require("chromedriver");

const metaMaskWallet = require('./MetaMaskWallet.js');
const MetaMaskWallet = metaMaskWallet.MetaMaskWallet;
const meta = require('./pages/MetaMask.js');
const buttonSubmit = require('./pages/MetaMask.js');
const voting = require('./pages/Voting.js');

const timeout = ms => new Promise(res => setTimeout(res, ms))

const votingURL = 'http://localhost:3002'

let validatorMetaData;
let newMiningKey;

let args = process.argv.slice(2);
let validator_num = args[0];

let files = dir.files(constants.votingKeysFolder, {sync:true});
files = files.filter((file) => {
	let isNotGitKeep = path.basename(file) !== path.basename(`${constants.votingKeysFolder}.gitkeep`);
	let isNotDsStore = path.basename(file) !== path.basename(`${constants.votingKeysFolder}.DS_Store`);
	return isNotGitKeep && isNotDsStore;
})
const votingKeyPath = files[validator_num - 1];

main()

async function main() {
	let options = new chrome.Options();
    options.addExtensions('./MetaMask_v3.14.1.crx');
	options.addArguments('start-maximized');
    options.addArguments('disable-popup-blocking');
	let driver = new webdriver.Builder()
	.withCapabilities(options.toCapabilities())
	.build();

	let wallet = MetaMaskWallet.createMetaMaskWallet(votingKeyPath);

	let metaMask = new meta.MetaMask(driver, wallet);
    let votingPage = await new voting.Voting(driver,votingURL);

    metaMask.open();
    metaMask.activate();

    metaMask.switchToAnotherPage();

    votingPage.open();

    driver.sleep(4000);

    votingPage.clickNewBallot();

    driver.sleep(3000);

    votingPage.chooseKeysVotingType();

    driver.sleep(1000);

    votingPage.chooseAddKeyVotingType();
    votingPage.chooseMiningKeyType();

    validatorMetaData = generateValidatorMetadata();

    votingPage.fillFullName(validatorMetaData.full_name);
    votingPage.fillAddress(validatorMetaData.address);
    votingPage.fillZipCode(validatorMetaData.zip_code);
    votingPage.fillLicenseID(validatorMetaData.license_id);
    votingPage.fillLicenseExpiration(validatorMetaData.license_expiration);
    votingPage.fillState(validatorMetaData.us_state);

    let votingMetaData = generateBallotMetadata();

    driver.sleep(1000);

    votingPage.fillDescription(votingMetaData.description);
    //votingPage.fillEndTime(votingMetaData.endTime);
    votingPage.fillAffectedKey(votingMetaData.affectedKey);
    votingPage.fillNewMiningKey();

    driver.sleep(2000);

    votingPage.addBallot();

    metamaskInteraction();

    driver.sleep(1000);

    votingPage.clickAlertOKButton();

    driver.sleep(60000);

    votingPage.vote();

    driver.sleep(60000);

    votingPage.finalize();

    async function metamaskInteraction() {
        driver.sleep(2000);

        metaMask.switchToAnotherPage();
        driver.sleep(3000);
        metaMask.refresh();
        driver.sleep(2000);
        let el = await metaMask.isElementPresent(buttonSubmit.buttonSubmit)
        if (el) {
            confirmTx(el)
        } else {
            console.log("Something went wrong. Let's try once more...")
            driver.sleep(2000);
            let el = await metaMask.isElementPresent(buttonSubmit.buttonSubmit)
            confirmTx(el)
        }
    }

    async function confirmTx(el) {
        metaMask.submitTransaction();
        votingPage.switchToAnotherPage();
    }
}

function generateValidatorMetadata() {
    let license_expiration = moment(new Date(faker.date.future())).format('DD/MM/YYYY');
    const validatorMetaData = {
        full_name: faker.name.findName(),
        address: `${faker.address.streetAddress()} ${faker.address.streetName()} ${faker.address.city()}`,
        us_state: "California",
        zip_code: faker.address.zipCode().split('-')[0],
        license_id: faker.random.alphaNumeric(10),
        license_expiration: license_expiration
    };

    return validatorMetaData;
}

function generateBallotMetadata() {
	const ballotMetaData = {
        description: `Add new validator ${validatorMetaData.full_name}
address: ${validatorMetaData.address}
us_state: ${validatorMetaData.us_state}
zip_code: ${validatorMetaData.zip_code}
license_id: ${validatorMetaData.license_id}
license_expiration: ${validatorMetaData.license_expiration}`,
        //endTime: (new Date()).toISOString(),//moment(new Date(faker.date.future())).format('DD/MM/YYYY'),//moment().add('1', 'minute').format('DD/MM/YYYY'),//.format('DD/MM/YYYY, HH:mm'),
        affectedKey: "0x29EFc7C1d7c12b5641DF2011e17A7A8cE19cc949"
    };

	return ballotMetaData;
}