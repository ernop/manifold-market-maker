import unittest
from unittest.mock import Mock
from history import DAY, History, summarize

class HistoryTests(unittest.TestCase):
    def test_sales_unfilled_redemptions_and_price_range(self):
        def bet(id,t,before,after,amount,**kw):
            return dict(id=id,createdTime=t,probBefore=before,probAfter=after,amount=amount,**kw)
        result=summarize([bet('prior',1,.2,.3,2),bet('a',DAY+1,.3,.8,10),
                          bet('b',DAY+2,.8,.4,-5),bet('unfilled',DAY+3,.4,.9,0),
                          bet('redemption',DAY+4,.4,.9,3,isRedemption=True)],DAY+10,True)
        self.assertEqual(result['trades'],2)
        self.assertEqual(result['volume'],15)
        self.assertAlmostEqual(result['change'],10)
        self.assertEqual((result['low'],result['high']),(30,80))
        self.assertEqual(result['points'][0],[10,.3])

    def test_missing_and_partial_are_explicit(self):
        self.assertEqual(summarize([],DAY,True)['points'],[])
        self.assertFalse(summarize([],DAY,False)['complete'])

    def test_cache_avoids_repeated_api_reads(self):
        api=Mock()
        api.request.return_value=[]
        history=History(api)
        self.assertEqual(history.get('abc'),history.get('abc'))
        api.request.assert_called_once()
        with self.assertRaises(ValueError): history.get('../bad')
