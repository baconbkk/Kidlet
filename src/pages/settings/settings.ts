import { Component } from '@angular/core';
import { NavController, NavParams, Platform, AlertController } from 'ionic-angular';
import { AlertProvider } from '../../providers/alert/alert.provider';
import { SimpleWallet } from 'nem-library';
import { WalletProvider } from '../../providers/wallet/wallet.provider';
import { NemProvider} from '../../providers/nem/nem.provider';
import { Storage } from '@ionic/storage';
import { FingerprintAIO, FingerprintOptions } from '@ionic-native/fingerprint-aio';

@Component({
  selector: 'page-settings',
  templateUrl: 'settings.html',
})
export class SettingsPage {
  selectedWallet: SimpleWallet;
  pass: string;
  common: any;
  authorized: boolean;
  fingerprintOptions : FingerprintOptions;

  constructor(
		private storage: Storage,
    private nem: NemProvider,
    private platform: Platform,
    public navCtrl: NavController,
    public navParams: NavParams,
    private alert: AlertProvider,
    private alertCtrl: AlertController,
    private wallet: WalletProvider,
    private fingerAuth: FingerprintAIO
  ) {

      this.wallet.getSelectedWallet().then(wallet => {
        this.selectedWallet = wallet;
        this.storage.get(this.selectedWallet.address.plain()).then(data => {
          if(data)
            this.authorized = true;
          else 
            this.authorized = false;
        })
      });
    }

  ionViewWillEnter() {
  }

  /**
   * Check if user can send tranaction
   * TODO: encapsulate in a service, implememntation it is duplicated in other controllers too
   */
  private _registerFingerprint() {
    if (this.common.password) {
        try {
            this.common.privateKey = this.nem.passwordToPrivateKey(this.common.password, this.selectedWallet);
            return true;
        } catch (err) {
            return false;
        }
    }
    return false;
  }

  public deleteFingerprint() {
    if (!this.platform.is('cordova')) {
      this.alert.showFunctionallityOnlyAvailableInMobileDevices();
      return;
    }
    let alert = this.alertCtrl.create({
      title: 'Confirm',
      message: 'Do you want to unregister this app.',
      buttons: [
        {
          text: 'Cancel'
        },
        {
          text: 'Confirm',
          handler: () => {
              this.fingerAuth.isAvailable().then(result =>{
                this.storage.remove(this.selectedWallet.address.plain()).then((val) => {
                  this.authorized = false;
                  this.alert.showCustomAlert("Fingerprint Authorization Unregistered.", null);
                }).catch((error) =>{
                  this.alert.showCustomAlert("Error: Fingerprint Authorization NOT Unregistered.", null);
                });
              }).catch((error:any) => {
                this.alert.showCustomAlert("Fingerprint Feature not available on your device", null);
              });
          }
        }
      ]
    });
    alert.present();
  }

  public fingerprintAuth() {
    // Object to contain our password & private key data.
    this.common = {
      'password': this.pass,
      'privateKey': ''
    };

    if (!this.platform.is('cordova')) {
      this.alert.showFunctionallityOnlyAvailableInMobileDevices();
      return;
    }

    if(!this._registerFingerprint()){
      this.alert.showInvalidPasswordAlert();
      return;
    }

    this.fingerprintOptions = {
        clientId: 'kidlet',
        clientSecret: this.common.password //Only necessary for Android
    }

    this.fingerAuth.isAvailable().then(result =>{
        this.fingerAuth.show(this.fingerprintOptions)
          .then((result: any) => {
            //store user wallet address here, along with password
            this.storage.set(this.selectedWallet.address.plain(), this.common.password);
            this.authorized = true;

            this.alert.showCustomAlert("Fingerprint Authentication is now registered.", null);
          }).catch((error: any) => {
            this.alert.showCustomAlert("Something went wrong.", null);
          });
    }).catch((error:any) => {
      this.alert.showCustomAlert("Fingerprint Feature not available on your device", null);
    });
  }

}
