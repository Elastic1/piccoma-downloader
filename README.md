# Piccoma-downloader
Download manga from [Piccoma](https://piccoma.com/)

## Basic Usage
1. Download [release](https://github.com/Elastic1/piccoma-downloader/releases)
2. Run `./piccoma.exe`
3. Enter your mail and password
4. Select mangas from the bookmarks list (all books are selected by default).
![usage-list](usage-list.png)

5. Wait for the download to finish.
![usage](usage.png)

## Options

Examples:  
```
./piccoma.exe --config config.json
``` 
```
./piccoma.exe --mail user@example.com --password mypassword --all
``` 
```
./piccoma.exe --sessionid <mysessionId>
``` 

#### `-h, --help`  
Display help message
#### `--type`
`jp` or `fr` (default: jp)
#### `--mail`
Account mail
#### `--password`
Account password
#### `--sessionid`
Session id of your piccoma login. For accounts that do not support email address login. 
#### `--all`
Download all mangas in bookmarks. If not specified, the selection cli will be displayed.
#### `--manga`
`chapter` or `volume` for manga (default: volume)
#### `--webtoon`
`chapter` or `volume` for webtoon (default: chapter)
#### `--timeout`
Maximum navigation time in milliseconds. If `0` no timeout. (default: 60000ms)
#### `--use-free`
Try to use one free ticket
#### `--format`
`png` or `jpg` (default: png)
#### `--quality`
jpg quality(default: 85)
#### `--out`
Output directory (default: manga)
#### `--config`
Path of config file. You can set the cli options in config file. Here's a [sample](https://github.com/Elastic1/piccoma-downloader/blob/main/config.json)
#### `--chapter-url`
Download chapter url
#### `--limit`
max concurrency limit (default: 2)