import { WALLET_TIMER_INTERVAL_MILLIS } from '$lib/constants/app.constants';
import { SchedulerTimer, type Scheduler, type SchedulerJobData } from '$lib/schedulers/scheduler';
import type { SolAddress } from '$lib/types/address';
import type {
	PostMessageDataRequestSol,
	PostMessageDataResponseError
} from '$lib/types/post-message';
import type { CertifiedData } from '$lib/types/store';
import type { Option } from '$lib/types/utils';
import { getSolTransactions, loadSolLamportsBalance } from '$sol/api/solana.api';
import type { SolCertifiedTransaction } from '$sol/stores/sol-transactions.store';
import type { SolanaNetworkType } from '$sol/types/network';
import type { SolPostMessageDataResponseWallet } from '$sol/types/sol-post-message';
import { mapSolTransactionUi } from '$sol/utils/sol-transactions.utils';
import { assertNonNullish, isNullish, jsonReplacer } from '@dfinity/utils';
import type { Lamports } from '@solana/rpc-types';

interface LoadSolWalletParams {
	solanaNetwork: SolanaNetworkType;
	address: SolAddress;
}

interface SolWalletStore {
	balance: CertifiedData<Option<Lamports>> | undefined;
	transactions: Record<string, SolCertifiedTransaction>;
}

interface SolWalletData {
	balance: CertifiedData<Lamports | null>;
	transactions: SolCertifiedTransaction[];
}

export class SolWalletScheduler implements Scheduler<PostMessageDataRequestSol> {
	private timer = new SchedulerTimer('syncSolWalletStatus');

	private store: SolWalletStore = {
		balance: undefined,
		transactions: {}
	};

	stop() {
		this.timer.stop();
	}

	async start(data: PostMessageDataRequestSol | undefined) {
		await this.timer.start<PostMessageDataRequestSol>({
			interval: WALLET_TIMER_INTERVAL_MILLIS,
			job: this.syncWallet,
			data
		});
	}

	async trigger(data: PostMessageDataRequestSol | undefined) {
		await this.timer.trigger<PostMessageDataRequestSol>({
			job: this.syncWallet,
			data
		});
	}

	private loadBalance = async ({
		address,
		solanaNetwork
	}: LoadSolWalletParams): Promise<CertifiedData<Lamports | null>> => ({
		data: await loadSolLamportsBalance({ network: solanaNetwork, address }),
		certified: false
	});

	private loadTransactions = async ({
		address,
		solanaNetwork
	}: LoadSolWalletParams): Promise<SolCertifiedTransaction[]> => {
		const transactions = await getSolTransactions({ network: solanaNetwork, address });
		return transactions
			.map((transaction) => ({
				data: mapSolTransactionUi({ transaction, address }),
				certified: false
			}))
			.filter(({ data: { id } }) => isNullish(this.store.transactions[`${id}`]));
	};

	private syncWallet = async ({ data }: SchedulerJobData<PostMessageDataRequestSol>) => {
		assertNonNullish(data, 'No data provided to get Solana balance.');

		try {
			const {
				address: { data: address },
				solanaNetwork
			} = data;

			const [balance, transactions] = await Promise.all([
				this.loadBalance({
					address,
					solanaNetwork
				}),
				this.loadTransactions({
					address,
					solanaNetwork
				})
			]);

			this.syncWalletData({ response: { balance, transactions } });
		} catch (error: unknown) {
			this.postMessageWalletError({ error });
		}
	};

	private syncWalletData = ({
		response: { balance, transactions }
	}: {
		response: SolWalletData;
	}) => {
		if (!this.store.balance?.certified && balance.certified) {
			throw new Error('Balance certification status cannot change from uncertified to certified');
		}

		const newBalance = isNullish(this.store.balance) || this.store.balance.data !== balance.data;
		const newTransactions = transactions.length > 0;

		this.store = {
			...this.store,
			...(newBalance && { balance }),
			...(newTransactions && {
				transactions: {
					...this.store.transactions,
					...transactions.reduce(
						(acc, transaction) => ({
							...acc,
							[transaction.data.id]: transaction
						}),
						{}
					)
				}
			})
		};

		if (!newBalance && !newTransactions) {
			return;
		}

		this.postMessageWallet({
			wallet: {
				balance,
				newTransactions: JSON.stringify(transactions, jsonReplacer)
			}
		});
	};

	private postMessageWallet(data: SolPostMessageDataResponseWallet) {
		this.timer.postMsg<SolPostMessageDataResponseWallet>({
			msg: 'syncSolWallet',
			data
		});
	}

	protected postMessageWalletError({ error }: { error: unknown }) {
		this.timer.postMsg<PostMessageDataResponseError>({
			msg: 'syncSolWalletError',
			data: {
				error
			}
		});
	}
}
