#!/usr/local/bin/python3
import sys
import time
import json
import urllib.parse
import hashlib
from datetime import datetime, timedelta, timezone
from curl_cffi import requests
import time
import io
import os

# Create logs and cache directories if they don't exist
os.makedirs('logs', exist_ok=True)
os.makedirs('Cache', exist_ok=True)

# Flush.. no buffer
#sys.stdout = io.TextIOWrapper(sys.stdout.detach(), line_buffering=True)

# Open the file at the beginning of the script
logfile = open('logs/TrendsLogFix', 'a')
# Function to write to the file
def write_to_file(content):
        logfile.write(content + '\n')

def get_cache_filename(keywords):
    """Generate a cache filename based on keywords"""
    # Create a hash of the keywords for the filename
    keywords_str = ','.join(sorted(keywords))  # Sort for consistency
    hash_obj = hashlib.md5(keywords_str.encode())
    return f"Cache/{hash_obj.hexdigest()}.json"

def is_cache_valid(cache_file):
    """Check if cache file exists and is newer than 1 day"""
    if not os.path.exists(cache_file):
        return False
    
    # Get file modification time
    file_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
    # Check if file is newer than 1 day
    return datetime.now() - file_time < timedelta(days=1)

def load_from_cache(cache_file):
    """Load data from cache file"""
    try:
        with open(cache_file, 'r') as f:
            cached_data = json.load(f)
            write_to_file(f"{datetime.now()}\t  CACHE HIT: Loading from cache file {cache_file}")
            return cached_data
    except Exception as e:
        write_to_file(f"{datetime.now()}\t  CACHE ERROR: Failed to load from {cache_file}: {str(e)}")
        return None

def save_to_cache(cache_file, data):
    """Save data to cache file"""
    try:
        with open(cache_file, 'w') as f:
            json.dump(data, f, indent=2)
            write_to_file(f"{datetime.now()}\t  CACHE SAVE: Saved to cache file {cache_file}")
    except Exception as e:
        write_to_file(f"{datetime.now()}\t  CACHE ERROR: Failed to save to {cache_file}: {str(e)}")


def build_payload(keywords, timeframe='today 5-y', geo=''):
    token_payload = {
        'hl': 'en-US',
        'tz': '0',
        'req': {
            'comparisonItem': [{'keyword': keyword, 'time': timeframe, 'geo': geo} for keyword in keywords],
            'category': 0,
            'property': ''
        }
    }
    token_payload['req'] = json.dumps(token_payload['req'])
    return token_payload

def convert_to_desired_format(raw_data):
    trend_data = {}
    for entry in raw_data['default']['timelineData']:
        timestamp = int(entry['time'])
        date_time_str = datetime.fromtimestamp(timestamp, timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        value = entry['value'][0]
        trend_data[date_time_str] = value
    return trend_data

# Cookies
#def get_google_cookies(impersonate_version='chrome110'):
def get_google_cookies(impersonate_version='safari15_5'):
    with requests.Session() as session:
        session.get("https://www.google.com", impersonate=impersonate_version)
        return session.cookies

#def fetch_trends_data(keywords, days_ago=10, geo='US', hl='en-US', max_retries=5, browser_version='chrome110', browser_switch_retries=5):
def fetch_trends_data(keywords, days_ago=10, geo='US', hl='en-US', max_retries=5, browser_version='safari15_5', browser_switch_retries=5):
    #browser_versions = ['chrome110', 'edge101', 'chrome107', 'chrome104', 'chrome100', 'chrome101', 'chrome99']
    browser_versions = ['safari15_5', 'chrome107', 'chrome104', 'chrome100', 'chrome101', 'chrome99']
    current_browser_version_index = browser_versions.index(browser_version)
    cookies = get_google_cookies(impersonate_version=browser_versions[current_browser_version_index])

    for browser_retry in range(browser_switch_retries + 1):
        data_fetched = False  # Reset data_fetched to False at the beginning of each browser_retry
        with requests.Session() as s:
            # phase 1: token
            for retry in range(max_retries):
                time.sleep(2)
                token_payload = build_payload(keywords)
                url = 'https://trends.google.com/trends/api/explore'
                params = urllib.parse.urlencode(token_payload)
                full_url = f"{url}?{params}"
                response = s.get(full_url, impersonate=browser_versions[current_browser_version_index], cookies=cookies)
                if response.status_code == 200:
                    content = response.text[4:]
                    try:
                        data = json.loads(content)
                        widgets = data['widgets']
                        tokens = {}
                        request = {}
                        for widget in widgets:
                            if widget['id'] == 'TIMESERIES':
                                tokens['timeseries'] = widget['token']
                                request['timeseries'] = widget['request']
                        break  # Break out of the retry loop as we got the token
                    except json.JSONDecodeError:
                        #print("LOG: ",keyword,"Failed to decode JSON while fetching token, retrying {",retry," + 1}/{max_retries}", file=sys.stderr)
                        write_to_file(f"LOG: {keywords[0]} Failed to decode JSON while fetching token, retrying {retry + 1}/{max_retries}. BrowsToken:{browser_versions[current_browser_version_index]}")
                else:
                    #print("LOG: ",keyword,"Error {response.status_code} while fetching token, retrying {",retry," + 1}/{max_retries}", file=sys.stderr)
                    write_to_file(f"LOG: {keywords[0]} Error {response.status_code} while fetching token, retrying {retry + 1}/{max_retries}. Browser:{browser_versions[current_browser_version_index]}")
            else:
                #print (f"{datetime.now()}\t   FAILED {keyword} Exceeded maximum {retry} attempts ({max_retries}) while fetching token. Exiting...")
                write_to_file(f"{datetime.now()}\t  FAILED {keywords[0]} Exceeded maximum {retry} attempts ({max_retries}) while fetching token. Browser:{browser_versions[current_browser_version_index]}. Exiting...")
                return None

            # phase 2: trends data
            for retry in range(max_retries):
                time.sleep(5)
                req_string = json.dumps(request['timeseries'], separators=(',', ':'))
                encoded_req = urllib.parse.quote(req_string, safe=':,+')
                url = f"https://trends.google.com/trends/api/widgetdata/multiline?hl={hl}&tz=0&req={encoded_req}&token={tokens['timeseries']}&tz=0"
                response = s.get(url, impersonate=browser_versions[current_browser_version_index], cookies=cookies)
                if response.status_code == 200:
                    content = response.text[5:]
                    try:
                        raw_data = json.loads(content)
                        # Convert raw data
                        trend_data = convert_to_desired_format(raw_data)
                        data_fetched = True  # Set data_fetched to True as we have successfully fetched the trend data
                        write_to_file(f"{datetime.now()}\t  SUCCESS {keywords[0]} tries:{retry}/{max_retries}. Browser:{browser_versions[current_browser_version_index]}")
                        return trend_data
                    except json.JSONDecodeError:
                        write_to_file(f"LOG: {keywords[0]} Failed to decode JSON while fetching trends data, retrying {retry + 1}/{max_retries}. Browser:{browser_versions[current_browser_version_index]}")
                else:
                    #print("LOG: ",keyword,"Error {response.status_code} while fetching trends data, retrying {",retry," + 1}/{max_retries}", file=sys.stderr)
                    write_to_file(f"LOG: {keywords[0]} Error {response.status_code} while fetching trends data, retrying {retry + 1}/{max_retries}")
            else:
                write_to_file(f"LOG: {keywords[0]} Exceeded maximum retry attempts ({max_retries}) while fetching trends data.Browser:{browser_versions[current_browser_version_index]}")
                #print("LOG: ",keyword,"Exceeded maximum retry attempts ({max_retries}) while fetching trends data.", file=sys.stderr)
                donothing = 1

        # change browser
        if not data_fetched and browser_retry < browser_switch_retries:
            time.sleep(5)
            current_browser_version_index = (current_browser_version_index + 1) % len(browser_versions)
            #print("LOG: ",keyword,"Switching browser version to {browser_versions[current_browser_version_index]} and retrying...", file=sys.stderr)
            write_to_file(f"LOG: {keywords[0]} Switching browser version to {browser_versions[current_browser_version_index]} and retrying...")

    write_to_file(f"{datetime.now()}\t  FAILED: {keywords[0]} Exceeded maximum browser switch attempts ({browser_switch_retries}). Browser:{browser_versions[current_browser_version_index]}. Exiting...")
    #print(f"ERROR: ",keyword,"Exceeded maximum browser switch attempts ({browser_switch_retries}). Exiting...", file=sys.stderr)
    return None

def get_trends_data(keywords):
    """
    Fetch Google Trends data for given keywords using curl_cffi with caching
    Returns JSON formatted data
    """
    try:
        # Convert keywords to list if it's a string
        if isinstance(keywords, str):
            keywords = [keywords]
        
        # Generate cache filename
        cache_file = get_cache_filename(keywords)
        
        # Check if we have valid cached data
        if is_cache_valid(cache_file):
            cached_data = load_from_cache(cache_file)
            if cached_data and cached_data.get('success'):
                write_to_file(f"{datetime.now()}\t  SUCCESS: Using cached data for {keywords}")
                return cached_data
        
        # Cache miss or invalid - fetch fresh data
        write_to_file(f"{datetime.now()}\t  CACHE MISS: Fetching fresh data for {keywords}")
        trend_data = fetch_trends_data(keywords)
        
        if trend_data is None:
            result = {
                'success': False,
                'error': 'Failed to fetch trends data from Google Trends',
                'data': [],
                'keywords': keywords
            }
            return result
        
        # Convert to our expected format
        data = []
        for date_str, value in trend_data.items():
            # Convert to just date (remove time)
            date_only = date_str.split(' ')[0]
            row_data = {'date': date_only}
            
            # Add each keyword's data
            for keyword in keywords:
                row_data[keyword] = int(value)
            
            data.append(row_data)
        
        # Sort by date
        data.sort(key=lambda x: x['date'])
        
        result = {
            'success': True,
            'data': data,
            'keywords': keywords
        }
        
        # Save to cache
        save_to_cache(cache_file, result)
        
        return result
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': f'Error fetching trends data: {str(e)}',
            'data': [],
            'keywords': keywords
        }
        return error_result

if __name__ == "__main__":
    # Get keywords from command line arguments
    if len(sys.argv) < 2:
        result = {'success': False, 'error': 'No keywords provided'}
        print(json.dumps(result))
        logfile.close()
        sys.exit(1)
    
    keyword = sys.argv[1]
    keywords = [keyword]
    
    # Remove debug output for API usage
    # print (f"            {keyword}  isPartial\ndate")
    result = get_trends_data(keywords)
    print(json.dumps(result))
    
    logfile.close()
