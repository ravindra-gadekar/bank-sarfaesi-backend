import { Router, Request, Response } from 'express';

interface DrtEntry {
  name: string;
  location: string;
  state: string;
  districts: string[];
}

const DRT_JURISDICTIONS: DrtEntry[] = [
  // Delhi
  { name: 'DRT-1 Delhi', location: 'New Delhi', state: 'Delhi', districts: ['Central Delhi', 'New Delhi', 'South Delhi'] },
  { name: 'DRT-2 Delhi', location: 'New Delhi', state: 'Delhi', districts: ['North Delhi', 'North East Delhi', 'North West Delhi'] },
  { name: 'DRT-3 Delhi', location: 'New Delhi', state: 'Delhi', districts: ['East Delhi', 'West Delhi', 'South West Delhi', 'Shahdara'] },

  // Maharashtra
  { name: 'DRT Mumbai', location: 'Mumbai', state: 'Maharashtra', districts: ['Mumbai', 'Mumbai Suburban', 'Thane', 'Raigad', 'Palghar'] },
  { name: 'DRT Pune', location: 'Pune', state: 'Maharashtra', districts: ['Pune', 'Satara', 'Solapur', 'Kolhapur', 'Sangli', 'Nashik', 'Ahmednagar'] },

  // Tamil Nadu
  { name: 'DRT-1 Chennai', location: 'Chennai', state: 'Tamil Nadu', districts: ['Chennai', 'Kancheepuram', 'Tiruvallur', 'Chengalpattu'] },
  { name: 'DRT-2 Chennai', location: 'Chennai', state: 'Tamil Nadu', districts: ['Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'] },

  // West Bengal
  { name: 'DRT-1 Kolkata', location: 'Kolkata', state: 'West Bengal', districts: ['Kolkata', 'Howrah', 'North 24 Parganas', 'South 24 Parganas'] },
  { name: 'DRT-2 Kolkata', location: 'Kolkata', state: 'West Bengal', districts: ['Hooghly', 'Burdwan', 'Nadia', 'Murshidabad', 'Darjeeling'] },

  // Karnataka
  { name: 'DRT Bangalore', location: 'Bengaluru', state: 'Karnataka', districts: ['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mangaluru', 'Hubballi'] },

  // Telangana
  { name: 'DRT Hyderabad', location: 'Hyderabad', state: 'Telangana', districts: ['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Sangareddy'] },

  // Gujarat
  { name: 'DRT Ahmedabad', location: 'Ahmedabad', state: 'Gujarat', districts: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'] },

  // Rajasthan
  { name: 'DRT Jaipur', location: 'Jaipur', state: 'Rajasthan', districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner'] },

  // Uttar Pradesh
  { name: 'DRT Lucknow', location: 'Lucknow', state: 'Uttar Pradesh', districts: ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Meerut', 'Noida', 'Ghaziabad'] },

  // Punjab / Haryana / Chandigarh
  { name: 'DRT Chandigarh', location: 'Chandigarh', state: 'Chandigarh', districts: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Panchkula', 'Ambala', 'Gurugram', 'Faridabad'] },

  // Bihar
  { name: 'DRT Patna', location: 'Patna', state: 'Bihar', districts: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga'] },

  // Kerala
  { name: 'DRT Ernakulam', location: 'Ernakulam', state: 'Kerala', districts: ['Ernakulam', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kottayam', 'Kollam'] },
];

// Build state-level index for fast lookups
const STATE_INDEX = new Map<string, DrtEntry[]>();
for (const entry of DRT_JURISDICTIONS) {
  const stateKey = entry.state.toLowerCase();
  if (!STATE_INDEX.has(stateKey)) {
    STATE_INDEX.set(stateKey, []);
  }
  STATE_INDEX.get(stateKey)!.push(entry);
}

// Punjab and Haryana map to Chandigarh DRT
STATE_INDEX.set('punjab', STATE_INDEX.get('chandigarh') || []);
STATE_INDEX.set('haryana', STATE_INDEX.get('chandigarh') || []);

const router = Router();

router.get('/lookup/drt', (req: Request, res: Response) => {
  const state = (req.query.state as string || '').trim();
  const district = (req.query.district as string || '').trim();

  if (!state) {
    res.status(400).json({ error: 'Query parameter "state" is required' });
    return;
  }

  const stateKey = state.toLowerCase();
  const stateDrts = STATE_INDEX.get(stateKey);

  if (!stateDrts || stateDrts.length === 0) {
    res.json({ results: [] });
    return;
  }

  // If district is provided, try to find the specific DRT
  if (district) {
    const districtLower = district.toLowerCase();
    const matched = stateDrts.filter(drt =>
      drt.districts.some(d => d.toLowerCase() === districtLower)
    );

    if (matched.length > 0) {
      res.json({
        results: matched.map(({ name, location, state: s }) => ({ name, location, state: s })),
      });
      return;
    }
  }

  // Return all DRTs for the state
  res.json({
    results: stateDrts.map(({ name, location, state: s }) => ({ name, location, state: s })),
  });
});

export default router;
