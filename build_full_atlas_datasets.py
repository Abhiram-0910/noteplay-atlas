import os
import json
import argparse
import requests
import zipfile
import io
import pandas as pd
import re

def normalize(name):
    # Removes spaces and special characters for the game's strict matching
    return re.sub(r'[^a-z]', '', str(name).lower())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--world-mode', default='cities500')
    parser.add_argument('--outdir', default='atlas_datasets_lighter')
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)

    print("Downloading world countries and states data...")
    # UPDATED: Using a stable, frozen mirror of the geographic database 
    # because the original author recently removed the direct JSON files.
    countries_url = "https://raw.githubusercontent.com/sainanky/countries-states-cities-database-1/master/countries.json"
    states_url = "https://raw.githubusercontent.com/sainanky/countries-states-cities-database-1/master/states.json"
    
    try:
        c_resp = requests.get(countries_url)
        c_resp.raise_for_status()
        countries = c_resp.json()
    except Exception as e:
        print(f"Failed to download countries: {e}")
        return

    try:
        s_resp = requests.get(states_url)
        s_resp.raise_for_status()
        states = s_resp.json()
    except Exception as e:
        print(f"Failed to download states: {e}")
        return

    world_data = []
    c_id = 1
    country_dict = {}
    
    print("Processing Countries...")
    for c in countries:
        name = c.get('name', '')
        country_dict[c.get('id')] = name
        norm = normalize(name)
        if norm:
            world_data.append({
                "id": f"country-{c_id}",
                "name": name,
                "category": "country",
                "country": name,
                "state": "",
                "district": "",
                "normalizedName": norm,
                "startingLetter": norm[0].upper(),
                "endingLetter": norm[-1].upper()
            })
            c_id += 1

    print("Processing States...")
    s_id = 1
    for s in states:
        name = s.get('name', '')
        c_name = country_dict.get(s.get('country_id'), "")
        norm = normalize(name)
        if norm:
            world_data.append({
                "id": f"state-{s_id}",
                "name": name,
                "category": "state",
                "country": c_name,
                "state": name,
                "district": "",
                "normalizedName": norm,
                "startingLetter": norm[0].upper(),
                "endingLetter": norm[-1].upper()
            })
            s_id += 1

    print("Downloading and Processing Global Cities (this takes about a minute)...")
    geo_url = "https://download.geonames.org/export/dump/cities500.zip"
    try:
        r = requests.get(geo_url)
        r.raise_for_status()
        
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            with z.open("cities500.txt") as f:
                df = pd.read_csv(f, sep='\t', header=None, usecols=[1, 8], names=['name', 'country_code'], dtype=str, keep_default_na=False)

        city_id = 1
        for _, row in df.iterrows():
            name = row['name']
            norm = normalize(name)
            if norm:
                world_data.append({
                    "id": f"city-{city_id}",
                    "name": name,
                    "category": "city",
                    "country": row['country_code'],
                    "state": "",
                    "district": "",
                    "normalizedName": norm,
                    "startingLetter": norm[0].upper(),
                    "endingLetter": norm[-1].upper()
                })
                city_id += 1
    except Exception as e:
        print(f"Failed to process cities: {e}")
        return

    out_cities = os.path.join(args.outdir, "world_cities.json")
    with open(out_cities, 'w', encoding='utf-8') as f:
        json.dump(world_data, f, indent=2)

    print("Merging with India districts and subdistricts...")
    master_data = list(world_data)
    for ind_file in ['india_districts.json', 'india_subdistricts.json']:
        path = os.path.join(args.outdir, ind_file)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                master_data.extend(json.load(f))
    
    out_master = os.path.join(args.outdir, "atlas_master_large.json")
    with open(out_master, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2)

    print(f"\nDone! Generated {len(world_data)} global locations.")
    print(f"Files saved successfully in {args.outdir}/")

if __name__ == '__main__':
    main()