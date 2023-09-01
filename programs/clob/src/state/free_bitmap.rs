use super::*;

use std::default::Default;

#[zero_copy]
pub struct FreeBitmap {
    inner: u128,
}

impl Default for FreeBitmap {
    fn default() -> Self {
        Self { inner: u128::MAX } // every chunk is free to start
    }
}

impl FreeBitmap {
    pub fn get_first_free_chunk(&self) -> Option<usize> {
        if self.inner > 0 {
            Some(self.inner.trailing_zeros() as usize)
        } else {
            None
        }
    }

    pub fn are_all_chunks_taken(&self) -> bool {
        self.inner == 0
    }

    pub fn mark_free(&mut self, index: u8) {
        self.set(index, true);
    }

    pub fn mark_reserved(&mut self, index: u8) {
        self.set(index, false);
    }

    // A duplication of https://github.com/bodil/bitmaps/blob/4ace01e0fe58988e44e497104ca6fc40eaee9352/src/types.rs#L175
    fn set(&mut self, index: u8, value: bool) {
        let mask = 1 << index;
        if value {
            self.inner |= mask;
        } else {
            self.inner &= !mask;
        }
    }
}
