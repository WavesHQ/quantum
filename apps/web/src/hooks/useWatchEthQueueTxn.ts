import { useNetworkEnvironmentContext } from "@contexts/NetworkEnvironmentContext";
import { useStorageContext } from "@contexts/StorageContext";
import {
  //   useAllocateDfcFundMutation,
  useConfirmEthQueueTxnMutation,
} from "@store/index";
import { HttpStatusCode } from "axios";
import { useEffect, useState } from "react";

/**
 * This polls in the /handle-transaction to verify if txn is confirmed (>= 65 confirmations)
 */
export default function useWatchEthQueueTxn() {
  const { networkEnv } = useNetworkEnvironmentContext();
  const { txnHash, setStorage } = useStorageContext();

  const [confirmEthQueueTxn] = useConfirmEthQueueTxnMutation();

  const [isQueueApiSuccess, setIsQueueApiSuccess] = useState(false);
  const [ethQueueTxnStatus, setEthQueueTxnStatus] = useState<{
    isConfirmed: boolean;
    numberOfConfirmations: string;
  }>({ isConfirmed: false, numberOfConfirmations: "0" });

  let pollInterval;

  /* Poll to check if the txn is already confirmed */
  useEffect(() => {
    setIsQueueApiSuccess(false);
    const pollConfirmEthTxn = async function poll(unconfirmed?: string) {
      try {
        if (unconfirmed === undefined) {
          return;
        }

        const confirmEthTxnData = await confirmEthQueueTxn({
          txnHash: unconfirmed,
        }).unwrap();

        if (!confirmEthTxnData) {
          return;
        }

        setEthQueueTxnStatus({
          isConfirmed: confirmEthTxnData?.isConfirmed,
          numberOfConfirmations: confirmEthTxnData?.numberOfConfirmations,
        });

        if (confirmEthTxnData?.isConfirmed) {
          setIsQueueApiSuccess(true);
        }

        setIsQueueApiSuccess(true);
      } catch ({ data }) {
        if (data?.error?.includes("Fund already allocated")) {
          setStorage("confirmed", unconfirmed ?? null);
          setStorage("unconfirmed", null);
          setStorage("txn-form", null);
        } else if (
          data?.error?.includes("There is a problem in allocating fund")
        ) {
          setStorage("unsent-fund", unconfirmed ?? null);
          setStorage("unconfirmed", null);
        } else if (
          data?.statusCode === HttpStatusCode.BadRequest &&
          data?.message === "Transaction Reverted"
        ) {
          setStorage("reverted", unconfirmed ?? null);
          setStorage("unconfirmed", null);
        } else if (data?.statusCode === HttpStatusCode.TooManyRequests) {
          //   handle throttle error;
        }
      }
    };

    if (pollInterval !== undefined) {
      clearInterval(pollInterval);
    }

    // Run on load
    if (!isQueueApiSuccess) {
      setEthQueueTxnStatus({
        isConfirmed: false,
        numberOfConfirmations: "0",
      });

      pollConfirmEthTxn(txnHash.unconfirmed);
    }

    pollInterval = setInterval(() => {
      pollConfirmEthTxn(txnHash.unconfirmed);
    }, 20000);

    return () => {
      if (pollInterval !== undefined) {
        clearInterval(pollInterval);
      }
    };
  }, [networkEnv, txnHash]);

  return { ethQueueTxnStatus, isQueueApiSuccess };
}