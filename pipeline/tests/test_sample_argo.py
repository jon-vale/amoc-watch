import unittest

from sample_argo import choose_profiles


class ArgoManifestTests(unittest.TestCase):
    def test_filters_by_month_region_and_float(self):
        index = "\n".join([
            "# comment",
            "aoml/1901/profiles/R1901_001.nc,20260601120000,55,-35,A,846,AO,20260602",
            "aoml/1901/profiles/R1901_002.nc,20260615120000,56,-34,A,846,AO,20260616",
            "aoml/1902/profiles/R1902_001.nc,20260531120000,55,-35,A,846,AO,20260601",
            "aoml/1903/profiles/R1903_001.nc,20260620120000,20,-35,A,846,AO,20260621",
            "aoml/1904/profiles/R1904_001.nc,20260701120000,55,-35,A,846,AO,20260702",
        ])
        result = choose_profiles(index, "2026-06-01", "2026-06-30", 20)
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]["file"].endswith("R1901_002.nc"))


if __name__ == "__main__":
    unittest.main()
