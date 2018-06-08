import {Component} from '@angular/core';
import {MenuController, NavController, LoadingController } from 'ionic-angular';
import {TranslateService} from '@ngx-translate/core';

import {NemProvider} from '../../providers/nem/nem.provider';
import {AlertProvider} from '../../providers/alert/alert.provider';
import {WalletProvider} from '../../providers/wallet/wallet.provider';

import {BalancePage} from '../balance/balance';
import {SignupPage} from '../signup/signup';

import {SimpleWallet} from 'nem-library';

import { LocalNotifications } from '@ionic-native/local-notifications';
//import { BackgroundMode } from '@ionic-native/background-mode';
import { Storage } from '@ionic/storage';

import { FingerprintAIO, FingerprintOptions } from '@ionic-native/fingerprint-aio';
import { NativeAudio } from '@ionic-native/native-audio';

import { FilePath } from '@ionic-native/file-path';
		
@Component({
    selector: 'page-login',
    templateUrl: 'login.html'
})
export class LoginPage {

    wallets: SimpleWallet[];
    selectedWallet: SimpleWallet;
	balance: any;			
	common: any;
	fingerprintOptions : FingerprintOptions;
	
    constructor(
		private storage: Storage,
		public navCtrl: NavController,
		private nem: NemProvider,
		private wallet: WalletProvider,
		private alert: AlertProvider,
		private loading: LoadingController,
		private menu: MenuController,
		public translate: TranslateService,

		private localNotifications: LocalNotifications,
		private fingerAuth: FingerprintAIO,
		private nativeAudio: NativeAudio,
		private filePath: FilePath
		//	private backgroundMode: BackgroundMode,
		) {

//		this.backgroundMode.enable();
        this.wallets = [];
        this.selectedWallet = null;
		
		//Objects to contain xem and kid balance for updating loop
		this.balance = {
			'xem': 0,
			'kid': 0
		};
		
        // Object to contain our password & private key data.
        this.common = {
            'password': '',
            'privateKey': ''
        };

        this.wallet.getWallets().then(value => {
            this.wallets = value;

            //select first loaded wallet by default
			if(this.wallets.length > 0) this.selectedWallet = this.wallets[0];
        });

    }

    ionViewWillEnter() {
        // the left menu should be disabled on the login page
		this.menu.enable(false);

    }

    ionViewWillLeave() {
        // enable the left menu when leaving the login page
        this.menu.enable(true);
    }

    compareFn(e1: any, e2: any): boolean {
        return e1 && e2 ? e1.name === e2.name : e1 === e2;
    }

	private runUpdateDetect() {
		setInterval(() => {
			var notificationText1 = "";
			var notificationText2 = "";
			
			//first get localstorage balance and put it into ionic page balance
			this.storage.get('balance').then((val) => {
				if(val){
					let templocalStorage = JSON.parse(val)
					this.balance.xem = templocalStorage.xem
					this.balance.kid = templocalStorage.kid
				} else {
					notificationText1 += "Welcome to kidlet! This is your balance: ";
					notificationText2 += "Welcome to kidlet! This is your balance: ";
				}
				
				//second get the nem.getBalance result
				this.nem.getBalance(this.selectedWallet.address).then(bal => {
					let updatedKidBal = 0;
					let updatedXemBal = 0;
					
					let xemChanged = false;
					let kidChanged = false;
					
					bal.forEach(function(curr,ind){
						if(curr.mosaicId.name == "kid")
							updatedKidBal = curr.amount		//update amount
						else if(curr.mosaicId.name == "xem")
							updatedXemBal = curr.amount		//updated amount
					});
					
					//third, compare the updated ionic page balance and the nem.getBalance result and determine update
					if(this.balance.xem < updatedXemBal){	//Will only send notifications when balance increases
						notificationText1 += "Xem: " + updatedXemBal + " (+" + (updatedXemBal - this.balance.xem).toFixed(2) + ")";
						xemChanged = true;

					//	this.filePath.resolveNativePath('file://ding2.mp3').then(filePath => {
					//		console.log(filePath);
							this.localNotifications.schedule({
								id: 1,
								title: 'Xem Balance Changed:',
								text: notificationText1,
								sound: 'file://ding2.mp3'
							});	
					//	}).catch(err => {
					//		console.log(err)
					//	});

					}
					
					if(this.balance.kid < updatedKidBal) {
						notificationText2 += "Kid: " + updatedKidBal + " (+" + (updatedKidBal - this.balance.kid).toFixed(2) + ")";
						kidChanged = true;
						
					//	this.filePath.resolveNativePath('file://ding2.mp3').then(filePath => {
					//		console.log(filePath);
							this.localNotifications.schedule({
								id: 1,
								title: 'Kid Balance Changed:',
								text: notificationText2,
								sound: 'file://ding2.mp3'
							});	
					//	}).catch(err => {
					//		console.log(err)
					//	});

					}

					//set the updated balances to lo calstorage so they can be used again for the next interval
					this.storage.set('balance',JSON.stringify({xem:updatedXemBal,kid:updatedKidBal}));
					
					//when user clicks on the notification
					if(kidChanged || xemChanged){
						this.localNotifications.on("click").subscribe((data) => {
							this.navCtrl.push(BalancePage);
						});
					}
				});
			});
		},3000)	//update is called every 3 seconds
	}

	public loginHandler(fingerprintAuth: boolean) {
		if (!this.selectedWallet) {
			this.alert.showWalletNotSelectedAlert();
			return;
		}
		
		if(fingerprintAuth){
			this.storage.get(this.selectedWallet.address.plain()).then((val) => {
				console.log(val)
				if(val){ //token exists for users wallet
	
					this.fingerprintOptions = {
						clientId: 'kidlet',
						clientSecret: val
					}
		
					this.fingerAuth.isAvailable().then(result =>{
						this.fingerAuth.show(this.fingerprintOptions).then((result: any) => {
							console.log(result)
							this.common.password = val;
							this.login();
						}).catch((error: any) => {
							console.log(error)
							this.alert.showCustomAlert("Something went wrong.", null);
						});
					}).catch((error:any) => {
					  this.alert.showCustomAlert("Fingerprint Feature not available on your device", null);
					});
				} else {
					this.alert.showCustomAlert("You have not yet added fingerprint authorization. Go to Settings inside the app.",null)
				}
			});
		} else
			this.login()
		
	}

    /**
     * Enters into the app with the selected wallet
     */
    private login() {
        this.translate.get('PLEASE_WAIT', {}).subscribe((res: string) => {
            let loader = this.loading.create({
                content: res
            });

            loader.present().then(_ => {
                if (!this.selectedWallet) {
                    loader.dismiss();
                    this.alert.showWalletNotSelectedAlert();
                }

                // Decrypt/generate private key and check it. Returned private key is contained into this.common
                try {
					this.common.privateKey = this.nem.passwordToPrivateKey(this.common.password, this.selectedWallet);
					this.wallet.setSelectedWallet(this.selectedWallet);

					this.runUpdateDetect();	//run interval to detect change

                    loader.dismiss();
                    this.navCtrl.setRoot(BalancePage);
                } catch (err) {
                    console.log(err);
                    this.common.privateKey = '';
                    loader.dismiss();
                    this.alert.showInvalidPasswordAlert();
                }
            });
        });
    }

    /**
     * Moves to Signup Page
     */
    public goToSignup() {
        this.navCtrl.push(SignupPage);
	}
}