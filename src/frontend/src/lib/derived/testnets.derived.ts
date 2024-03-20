import { LOCAL } from '$lib/constants/app.constants';
import { testnetsStore } from '$lib/stores/testnets.store';
import { derived, type Readable } from 'svelte/store';

export const testnets: Readable<boolean> = derived(
	[testnetsStore],
	([$testnetsStore]) => $testnetsStore?.enabled ?? LOCAL
);
