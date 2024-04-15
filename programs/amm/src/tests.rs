#[cfg(test)]
mod simple_amm_tests {
    use crate::state::*;
    use crate::utils::*;

    #[test]
    pub fn base_case_amm() {
        let mut amm = Amm { ..Amm::default() };
        assert_eq!(amm.get_ltwap().unwrap(), 0);
        assert_eq!(amm.swap(1, true).unwrap(), 0);
        assert_eq!(amm.swap(1, false).unwrap(), 1);
        assert_eq!(amm.k(), 0);
    }

    #[test]
    pub fn medium_amm() {
        let mut amm = Amm {
            base_amount: 10000,
            quote_amount: 10000,
            swap_fee_bps: 1,
            ..Amm::default()
        };

        assert_eq!(amm.get_ltwap().unwrap(), 0);
        assert_eq!(amm.swap(1, true).unwrap(), 0);
        assert_eq!(amm.swap(1, false).unwrap(), 0);
        assert_eq!(amm.k(), 100020001);

        assert_eq!(amm.swap(100, true).unwrap(), 99);
        assert_eq!(amm.swap(100, false).unwrap(), 100);
        assert_eq!(amm.k(), 100030002);

        assert_eq!(amm.swap(1000, true).unwrap(), 909);
        assert_eq!(amm.swap(1000, false).unwrap(), 1089);
        assert_eq!(amm.k(), 100041816);
    }

    #[test]
    pub fn medium_amm_with_swap_err() {
        let mut amm = Amm {
            base_amount: 10000,
            quote_amount: 10000,
            swap_fee_bps: 1,
            ..Amm::default()
        };

        amm.swap(amm.quote_amount - 1, true).unwrap();

        assert_eq!(amm.k(), 10);


        // todo?
        // assert!(amm.swap(amm.quote_amount - 1, true).is_err());
    }

}