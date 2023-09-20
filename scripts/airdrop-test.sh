#!/usr/bin/env bash

set -eExuo pipefail

# rm -rf .dfx
dfx identity use default
dfx canister stop airdrop || true
dfx canister delete airdrop || true

# Depth                /----- code generated by someone from the authorized lists of principals
# 0                    *      ----> `root_level_codes`
#              /       |       \
# 1            *       *        *   ------> Make sure we can redeem all three child code
#          /   |   \
# 2            * -----------> this code should not have children --- should they get the full amount directly or a fourth like the rest?

# ===> per code generated we will issue 12 more ==> 13 total per QR Code scanned ----

# A given principal should not be able to redeem a code more than once

# Create multiple identies -- collect all of them in a list of principals
principals=()
identities=()

for i in {1..10}
do
    tmp_identity+=("identity-$i")
    dfx identity new "${tmp_identity}" || true
    dfx identity use "${tmp_identity}"

    # we add principals as we create them
    principals+=("$(dfx identity get-principal)")
done

# check the list of principals
dfx identity use default
dfx deploy airdrop --argument "(vec {\"$(dfx identity get-principal)\"})"

# TODO generate a list of codes

dfx canister call airdrop add_codes '(vec {"AAAAA"; "BBBBB"; "CCCCC"; "DDDDDD", "oaenut", "oenuth", "oaesnuth", "oesunth", "aosneuth"})'

# switch to the first identity
dfx identity use "${identities[0]}"

root_level_code=()
# check that we can generate 10 codes
for i in {1..10}
do
    dfx canister call airdrop generate_code
    # root_level_code+=("${dfx canister call airdrop generate_code | grep -o 'CODE-[0-9]\+'}")
done

# redeem one of the root level code

# redeem all of its children

# pick one of those children and redeem all of them

# check no more children are generated aferwards

# check that we cannot redeem code more than once

# check we get the same children everytime

# check that we can actually kill the cannister

# this call should not execute
