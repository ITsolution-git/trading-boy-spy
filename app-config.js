module.exports = {

  log: {
    folderPath: './logs',
    timeZone: 'Europe/London',
    // folderPath: path.join(__dirname, '../public/logs/'),
    // dateBasedFileNaming: true,
    // // Required only if dateBasedFileNaming is set to false
    // fileName: 'All_Logs',   
    // // Required only if dateBasedFileNaming is set to true
    fileNamePrefix: '',
    fileNameSuffix: '	',
    fileNameExtension: '.log',     
    
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss.SSS',
    logLevel: 'debug',
    onlyFileLogging: false
  },
};